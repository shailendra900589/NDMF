const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
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
} = require('../../lib/faceMatch');
const { workTypeOf, cleanRadius, MIN_RADIUS_M, MAX_RADIUS_M } = require('../../lib/officeGeofence');

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

exports.getFaceEnrollment = (req, res) => {
  const user = findById('users', req.user.id);
  if (!user) return error(res, 'User not found', 404);
  const urls = user.faceEnrollmentUrls || [];
  return success(res, {
    complete: isEnrollmentComplete(user),
    count: urls.length,
    required: 3,
    enrolledAt: user.faceEnrollmentAt || null,
    problem: user.faceEnrollmentValid === false ? user.faceEnrollmentProblem || null : null,
  });
};

exports.saveFaceEnrollment = async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length < 3) {
    return error(res, 'Upload at least 3 face reference photos');
  }
  const user = findById('users', req.user.id);
  if (!user) return error(res, 'User not found', 404);
  if (isEnrollmentComplete(user) && Array.isArray(user.faceDescriptors)) {
    return error(res, 'Face is already registered. Ask your branch or admin to reset it.', 403);
  }
  const cleanUrls = urls.slice(0, 5).map((u) => String(u).trim());
  let descriptors;
  try {
    descriptors = await buildEnrollment(cleanUrls);
  } catch (err) {
    if (err instanceof FaceCheckError) return error(res, err.message, 400);
    console.error('Face enrollment check failed:', err);
    return error(res, 'Face check is not available right now — try again in a minute', 503);
  }
  user.faceEnrollmentUrls = cleanUrls;
  user.faceEnrollmentAt = new Date().toISOString();
  user.faceDescriptors = descriptors;
  user.faceDescriptorUrls = cleanUrls.join('|');
  user.faceDescriptorVersion = DESCRIPTOR_VERSION;
  user.faceEnrollmentValid = true;
  delete user.faceEnrollmentProblem;
  delete user.faceVerification;
  delete user.faceVerifyFailures;
  upsert('users', user);
  return success(res, sanitizeUser(user), 'Face enrollment saved');
};

/** Admin or the employee's branch clears a registered face so it can be captured again. */
exports.resetFaceEnrollment = (req, res) => {
  const target = findById('users', req.params.id);
  if (!target) return error(res, 'User not found', 404);
  if (!canManageUser(req.user, target)) {
    return error(res, 'You cannot reset this employee', 403);
  }
  delete target.faceEnrollmentUrls;
  delete target.faceEnrollmentAt;
  delete target.faceDescriptors;
  delete target.faceDescriptorUrls;
  delete target.faceDescriptorVersion;
  delete target.faceEnrollmentValid;
  delete target.faceEnrollmentProblem;
  delete target.faceVerification;
  delete target.faceVerifyFailures;
  upsert('users', target);
  return success(res, sanitizeUser(target), 'Face reset — employee must register again');
};

exports.getAll = (req, res) => {
  const all = getCollection('users');
  let users = listUsersVisibleTo(req.user, all);
  users = users.map(sanitizeUser);
  users.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return success(res, users);
};

exports.create = (req, res) => {
  const { name, mobile, employeeId, role, branch, password, permissions } = req.body;
  if (!name || !mobile || !employeeId || !role || !branch || !password) {
    return error(res, 'name, mobile, employeeId, role, branch, password required');
  }
  if (password.length < 4) return error(res, 'Password min 4 characters');

  const allowed = allowedRolesForCreator(req.user);
  if (!allowed.includes(role)) {
    return error(res, `You cannot create role: ${role}`, 403);
  }
  if (!isAdmin(req.user) && !sameBranch(req.user, branch)) {
    return error(res, 'You can only create employees in your branch', 403);
  }

  const users = getCollection('users');
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

  const user = {
    id: `U_${uuid().slice(0, 8)}`,
    name: name.trim(),
    mobile: mobile.trim(),
    employeeId: employeeId.trim(),
    branch: branch.trim(),
    role,
    password: bcrypt.hashSync(password, 10),
    permissions: Object.keys(perm).length ? perm : undefined,
    workType: 'field',
    attendanceRadiusM: null,
    ...attendance.fields,
    isActive: true,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  upsert('users', user);
  return success(res, sanitizeUser(user), 'Employee created', 201);
};

exports.update = (req, res) => {
  const target = findById('users', req.params.id);
  if (!target) return error(res, 'User not found', 404);
  if (!canManageUser(req.user, target)) return error(res, 'Forbidden', 403);

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

  if (branch && isAdmin(req.user)) {
    target.branch = branch.trim();
  }

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

  if (password && password.length >= 4) {
    target.password = bcrypt.hashSync(password, 10);
  }

  Object.assign(target, attendance.fields);

  upsert('users', target);
  return success(res, sanitizeUser(target), 'User updated');
};

exports.getPermissionSchema = (req, res) => {
  return success(res, {
    keys: assignablePermissionKeys(req.user),
    roleDefaults: ROLE_DEFAULTS,
    canCreateRoles: allowedRolesForCreator(req.user),
  });
};
