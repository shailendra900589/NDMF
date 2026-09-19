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

function sanitizeUser(user) {
  const { password, ...safe } = user;
  safe.permissions = effectivePermissions(user);
  return safe;
}

exports.getAll = (req, res) => {
  const all = getCollection('users');
  let users = listUsersVisibleTo(req.user, all);
  users = users.map(sanitizeUser);
  users.sort((a, b) => a.name.localeCompare(b.name));
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

  const user = {
    id: `U_${uuid().slice(0, 8)}`,
    name: name.trim(),
    mobile: mobile.trim(),
    employeeId: employeeId.trim(),
    branch: branch.trim(),
    role,
    password: bcrypt.hashSync(password, 10),
    permissions: Object.keys(perm).length ? perm : undefined,
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

  const { name, branch, permissions, isActive, password } = req.body;
  const assignable = assignablePermissionKeys(req.user);

  if (name) target.name = name.trim();

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
