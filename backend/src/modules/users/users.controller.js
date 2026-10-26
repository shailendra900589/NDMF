const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const {
  isAdmin,
  effectivePermissions,
  canManageUser,
  listUsersVisibleTo,
  assignablePermissionKeys,
  allowedRolesForCreator,
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  sameBranch,
} = require('../../lib/rbac');
const { settingsForClient } = require('../../lib/appSettings');
const {
  FaceCheckError,
  buildEnrollment,
  isEnrollmentComplete,
  stripFaceSecrets,
  DESCRIPTOR_VERSION,
  enrollmentUrls,
  enrollmentStatus,
  enrollmentRevision,
  validDescriptors,
} = require('../../lib/faceMatch');
const { workTypeOf, cleanRadius, MIN_RADIUS_M, MAX_RADIUS_M } = require('../../lib/officeGeofence');
const { salaryUpdate } = require('../../lib/payrollCalculation');

function sanitizeUser(user) {
  const { password, ...rest } = user;
  const safe = stripFaceSecrets(rest);
  safe.permissions = effectivePermissions(user);
  safe.workType = workTypeOf(user);
  safe.attendanceRadiusM = cleanRadius(user.attendanceRadiusM) || null;
  return { ...safe, ...settingsForClient() };
}

/** Office/field attendance settings from the body. */
function attendanceSettings(body) {
  const out = {};
  if (body.workType !== undefined) {
    if (!['office', 'field'].includes(body.workType)) return { error: 'Work type must be office or field' };
    out.workType = body.workType;
  }
  if (body.attendanceRadiusM !== undefined) {
    const r = cleanRadius(body.attendanceRadiusM);
    if (r === undefined) return { error: `Radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M} metres` };
    out.attendanceRadiusM = r;
  }
  return { fields: out };
}

function branchAssignments(body, role, actor, primaryBranch) {
  if (role === 'admin') return { branches: [] };
  const supplied = Array.isArray(body.branches) ? body.branches : [];
  const values = [...new Set([primaryBranch, ...supplied].filter(Boolean).map(v => String(v).trim()))];
  if (!values.length) return { error: 'Choose at least one location' };
  if (!isAdmin(actor) && values.some(branch => !sameBranch(actor, branch))) return { error: 'You can only assign employees to your branch' };
  const active = getCollection('branches').filter(b => b.isActive !== false).map(b => b.name);
  if (values.some(branch => !active.includes(branch))) return { error: 'Choose active company locations' };
  return { branches: values };
}

exports.getFaceEnrollment = (req, res) => {
  const user = findById('users', req.user.id);
  if (!user) return error(res, 'User not found', 404);
  res.set('Cache-Control', 'private, no-store');
  return success(res, enrollmentStatus(user));
};

exports.saveFaceEnrollment = async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length < 3) {
    return error(res, 'Upload at least 3 face reference photos');
  }
  let user = findById('users', req.user.id);
  if (!user) return error(res, 'User not found', 404);
  const cleanUrls = enrollmentUrls({ faceEnrollmentUrls: urls.slice(0, 5) });
  if (cleanUrls.length < 3 || cleanUrls.length !== Math.min(urls.length, 5) || new Set(cleanUrls).size !== cleanUrls.length) {
    return error(res, 'Upload 3–5 different reference photos from this account');
  }
  if (isEnrollmentComplete(user) && validDescriptors(user.faceDescriptors)) {
    if (enrollmentUrls(user).join('|') === cleanUrls.join('|')) {
      await flush();
      return success(res, sanitizeUser(user), 'Face enrollment already saved');
    }
    return error(res, 'Face is already registered. Ask your branch or admin to reset it.', 403);
  }
  const revision = enrollmentRevision(user);
  let descriptors;
  try {
    descriptors = await buildEnrollment(cleanUrls);
  } catch (err) {
    if (err instanceof FaceCheckError) return error(res, err.message, 400);
    console.error('Face enrollment check failed:', err);
    return error(res, 'Face check is not available right now — try again in a minute', 503);
  }
  // Inference can take seconds; do not overwrite profile edits or a concurrent reset.
  user = findById('users', req.user.id);
  if (!user || user.isActive === false || enrollmentRevision(user) !== revision) return error(res, 'Face registration changed while saving. Refresh and try again.', 409);
  user = { ...user };
  user.faceEnrollmentUrls = cleanUrls;
  user.faceEnrollmentAt = new Date().toISOString();
  user.faceEnrollmentRevision = uuid();
  user.faceDescriptors = descriptors;
  user.faceDescriptorUrls = cleanUrls.join('|');
  user.faceDescriptorVersion = DESCRIPTOR_VERSION;
  user.faceEnrollmentValid = true;
  delete user.faceEnrollmentProblem;
  delete user.faceVerification;
  delete user.faceVerifyFailures;
  upsert('users', user, { single: true });
  await flush();
  return success(res, sanitizeUser(user), 'Face enrollment saved');
};

function clearFaceEnrollment(target) {
  target.faceEnrollmentRevision = uuid();
  delete target.faceEnrollmentUrls;
  delete target.faceEnrollmentAt;
  delete target.faceDescriptors;
  delete target.faceDescriptorUrls;
  delete target.faceDescriptorVersion;
  delete target.faceEnrollmentValid;
  delete target.faceEnrollmentProblem;
  delete target.faceVerification;
  delete target.faceVerifyFailures;
  return target;
}

/** Allows an employee to replace unusable face references from their own profile. */
exports.resetOwnFaceEnrollment = async (req, res) => {
  const target = findById('users', req.user.id);
  if (!target || target.isActive === false || target.isDeleted) return error(res, 'User not found', 404);
  clearFaceEnrollment(target);
  upsert('users', target, { single: true });
  upsert('platformAudit', { id: uuid(), companyId: req.user.companyId, actorId: req.user.id,
    action: 'employee.face.reset.self', targetId: target.id, createdAt: new Date().toISOString() }, { single: true });
  await flush();
  return success(res, sanitizeUser(target), 'Face reset — capture 3 new reference selfies before attendance');
};

/** Admin or the employee's branch clears a registered face so it can be captured again. */
exports.resetFaceEnrollment = async (req, res) => {
  const target = findById('users', req.params.id);
  if (!target) return error(res, 'User not found', 404);
  if (!canManageUser(req.user, target)) {
    return error(res, 'You cannot reset this employee', 403);
  }
  clearFaceEnrollment(target);
  upsert('users', target, { single: true });
  upsert('platformAudit', { id: uuid(), companyId: req.user.companyId, actorId: req.user.id,
    action: 'employee.face.reset.manager', targetId: target.id, createdAt: new Date().toISOString() }, { single: true });
  await flush();
  return success(res, sanitizeUser(target), 'Face reset — employee must register again');
};

exports.getAll = (req, res) => {
  const all = getCollection('users');
  let users = listUsersVisibleTo(req.user, all).filter(u=>!u.isDeleted);
  users = users.map(sanitizeUser);
  users.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return success(res, users);
};

exports.create = async (req, res) => {
  const { name, mobile, employeeId, role, branch, password, permissions } = req.body;
  if (!name || !mobile || !employeeId || !role || !password || (role !== 'admin' && !branch)) {
    return error(res, 'Name, mobile, employee ID, role and password are required; employees also need a location');
  }
  if (typeof password !== 'string' || password.length < 4) return error(res, 'Password min 4 characters');
  if (req.body.isActive !== undefined && typeof req.body.isActive !== 'boolean') return error(res, 'Invalid account status');

  const allowed = allowedRolesForCreator(req.user);
  if (!allowed.includes(role)) {
    return error(res, `You cannot create role: ${role}`, 403);
  }
  if (!isAdmin(req.user) && !sameBranch(req.user, branch)) {
    return error(res, 'You can only create employees in your branch', 403);
  }
  if (role !== 'admin' && !getCollection('branches').some(b => b.name === String(branch).trim() && b.isActive !== false)) {
    return error(res, 'Choose an active company location');
  }

  const users = getCollection('users');
  const allUsers = require('../../lib/tenantContext').context.run(undefined, () => getCollection('users'));
  const loginKeys = [mobile, employeeId].map(v => String(v).trim().toLowerCase());
  if (allUsers.some(u => u.companyId !== req.user.companyId && [u.mobile, u.employeeId, u.email].some(v => loginKeys.includes(String(v || '').trim().toLowerCase())))) return error(res, 'Login ID or mobile is already in use', 409);
  if (users.some((u) => u.mobile === mobile && u.role === role)) {
    return error(res, 'User with this mobile and role already exists');
  }
  if (users.some((u) => u.employeeId === employeeId)) {
    return error(res, 'Employee ID already in use');
  }

  const assignable = assignablePermissionKeys(req.user);
  const perm = {};
  PERMISSION_KEYS.forEach((k) => {
    if (!assignable.includes(k)) return;
    if (permissions && typeof permissions[k] === 'boolean') {
      perm[k] = permissions[k];
    }
  });
  if (role === 'admin' && !isAdmin(req.user)) {
    return error(res, 'Only admin can create admin users', 403);
  }
  const attendance = attendanceSettings(req.body);
  if (attendance.error) return error(res, attendance.error);
  const assignments = branchAssignments(req.body, role, req.user, branch);
  if (assignments.error) return error(res, assignments.error);

  let user = {
    id: `U_${uuid().slice(0, 8)}`,
    name: name.trim(),
    mobile: mobile.trim(),
    employeeId: employeeId.trim(),
    branch: branch ? branch.trim() : null,
    branches: assignments.branches,
    role,
    password: bcrypt.hashSync(password, 10),
    permissions: Object.keys(perm).length ? perm : undefined,
    workType: 'field',
    attendanceRadiusM: null,
    ...attendance.fields,
    isActive: req.body.isActive !== false,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  if (req.body.monthlySalary !== undefined && String(req.body.monthlySalary).trim() !== '') {
    if (role === 'admin') return error(res, 'Monthly salary can be set for employees and managers only');
    const month = String(req.body.salaryEffectiveMonth || '').trim();
    const reason = String(req.body.salaryReason || 'Initial monthly salary').trim();
    if (reason.length < 3 || reason.length > 500) return error(res, 'Enter a salary reason (3–500 characters)');
    try {
      user = salaryUpdate(user, req.body.monthlySalary, month, req.user.id);
    } catch (err) {
      return error(res, err.message);
    }
    upsert('platformAudit', { id: uuid(), companyId: req.user.companyId, actorId: req.user.id,
      action: 'employee.salary.created', targetId: user.id, amount: Number(req.body.monthlySalary), month, reason, createdAt: new Date().toISOString() }, { single: true });
  }
  upsert('users', user);
  await flush();
  return success(res, sanitizeUser(user), 'Employee created', 201);
};

exports.update = async (req, res) => {
  const stored = findById('users', req.params.id);
  if (!stored) return error(res, 'User not found', 404);
  const target = structuredClone(stored);
  if (!canManageUser(req.user, target)) return error(res, 'Forbidden', 403);
  if(target.isDeleted)return error(res,'Employee has been deleted',409);
  if(req.body.mobile!==undefined){
    const mobile=String(req.body.mobile).trim();
    if(!/^\d{10}$/.test(mobile))return error(res,'Enter a valid 10-digit mobile number');
    const all=require('../../lib/tenantContext').context.run(undefined,()=>getCollection('users'));
    if(all.some(u=>u.id!==target.id && (String(u.employeeId || '').toLowerCase()===mobile || String(u.email || '').toLowerCase()===mobile || (u.mobile===mobile && (u.companyId!==target.companyId || u.role===(req.body.role || target.role))))))return error(res,'Mobile or login ID is already in use',409);
    target.mobile=mobile;
  }

  const { name, branch, role, permissions, isActive, password } = req.body;
  const assignable = assignablePermissionKeys(req.user);
  const attendance = attendanceSettings(req.body);
  if (attendance.error) return error(res, attendance.error);

  if (name) target.name = name.trim();

  if (role && role !== target.role) {
    if (target.id === req.user.id) {
      return error(res, 'You cannot change your own role', 400);
    }
    const allowed = allowedRolesForCreator(req.user);
    if (!allowed.includes(role)) {
      return error(res, `You cannot assign role: ${role}`, 403);
    }
    if (role === 'admin' && !isAdmin(req.user)) {
      return error(res, 'Only admin can assign admin role', 403);
    }
    const users = getCollection('users');
    if (users.some((u) => u.id !== target.id && u.mobile === target.mobile && u.role === role)) {
      return error(res, 'Another account with this mobile already has that role', 409);
    }
    target.role = role;
    if (!permissions) {
      target.permissions = { ...(ROLE_DEFAULTS[role] || {}) };
    }
  }

  if (branch !== undefined && isAdmin(req.user)) {
    target.branch = String(branch || '').trim() || null;
  }
  const assignments = (req.body.branch !== undefined || req.body.branches !== undefined || target.role !== stored.role)
    ? branchAssignments(req.body, target.role, req.user, target.branch)
    : { branches: Array.isArray(target.branches) && target.branches.length ? target.branches : [target.branch].filter(Boolean) };
  if (assignments.error) return error(res, assignments.error);
  target.branches = assignments.branches;

  if (permissions && typeof permissions === 'object') {
    const next = { ...(target.permissions || {}) };
    PERMISSION_KEYS.forEach((k) => {
      if (!assignable.includes(k)) return;
      if (typeof permissions[k] === 'boolean') next[k] = permissions[k];
    });
    target.permissions = next;
  }

  if (typeof isActive === 'boolean' && target.id !== req.user.id) {
    target.isActive = isActive;
  }

  if (password && (typeof password !== 'string' || password.length < 4)) return error(res, 'Password min 4 characters');
  if (password) {
    target.password = bcrypt.hashSync(password, 10);
  }

  Object.assign(target, attendance.fields);
  if(stored.role==='admin' && stored.isActive!==false && (target.role!=='admin' || target.isActive===false) && !getCollection('users').some(u=>u.id!==target.id && u.role==='admin' && u.isActive!==false))return error(res,'Keep at least one active company administrator',409);

  upsert('users', target);
  await flush();
  return success(res, sanitizeUser(target), 'User updated');
};

exports.remove = async(req,res)=>{
  const target=findById('users',req.params.id);
  if(!target || target.isDeleted)return error(res,'Employee not found',404);
  if(!canManageUser(req.user,target))return error(res,'Forbidden',403);
  if(target.id===req.user.id)return error(res,'You cannot delete your own account',409);
  if(target.role==='admin' && target.isActive!==false && !getCollection('users').some(u=>u.id!==target.id && u.role==='admin' && u.isActive!==false))return error(res,'Keep at least one active company administrator',409);
  upsert('users',{...target,isActive:false,isDeleted:true,deletedAt:new Date().toISOString(),deletedBy:req.user.id},{single:true});await flush();
  return success(res,{id:target.id},'Employee removed. Login disabled; attendance and payroll history preserved.');
};

exports.getPermissionSchema = (req, res) => {
  return success(res, {
    keys: assignablePermissionKeys(req.user),
    roleDefaults: ROLE_DEFAULTS,
    canCreateRoles: allowedRolesForCreator(req.user),
    permissionManagedByPlatform: true,
  });
};
