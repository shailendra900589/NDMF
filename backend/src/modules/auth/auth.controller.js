/**
 * AUTH CONTROLLER
 * ---------------
 * Login by Login ID (employeeId OR mobile) + password only — no role select.
 * Flutter app aur React admin dono use karenge.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getCollection, upsert } = require('../../lib/db');
const { jwtSecret } = require('../../config/env');
const { success, error } = require('../../lib/response');
const { effectivePermissions } = require('../../lib/rbac');
const { settingsForClient } = require('../../lib/appSettings');
const { stripFaceSecrets } = require('../../lib/faceMatch');

const DEMO_OTP = '123456';
const { context } = require('../../lib/tenantContext');
const { companyFor, allModules } = require('../../lib/companyPolicy');

function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  const safe = stripFaceSecrets(rest);
  if (user.role === 'superAdmin') return { ...safe, permissions: {}, company: null };
  const company = companyFor(user);
  safe.permissions = effectivePermissions(user);
  safe.company = company ? { id: company.id, name: company.name, code: company.code, logoUrl: company.logoUrl || '' } : null;
  safe.actions = Object.fromEntries(Object.keys(allModules()).map(k => [k, Object.fromEntries(['create','update','delete','approve','export'].map(a => [a, company?.actions?.[k]?.[a] !== false && user.platformActions?.[k]?.[a] !== false]))]));
  return context.run({ companyId: user.companyId, userId: user.id }, () => require('../../lib/privateUploads').signMedia({ ...safe, ...settingsForClient(),...(['fieldOfficer','branchManager'].includes(user.role)?{faceAttendanceRequired:true}:{}) }));
}

/** Normalize Login ID from body (loginId | mobile | employeeId). */
function resolveLoginId(body = {}) {
  return String(body.loginId || body.mobile || body.employeeId || '')
    .trim()
    .replace(/\s+/g, '');
}

/** Find users by employeeId (case-insensitive) or exact mobile. */
function findByLoginId(loginId) {
  const users = getCollection('users');
  const needle = loginId.toLowerCase();
  return users.filter((u) => {
    const mobile = String(u.mobile || '').trim();
    const emp = String(u.employeeId || '').trim().toLowerCase();
    return mobile === loginId || emp === needle || String(u.email || '').trim().toLowerCase() === needle;
  });
}

/**
 * Pick account: if optional role provided use it (legacy), else first matching password.
 * Same mobile can have multiple roles — password decides which account.
 */
function pickUser(candidates, password, preferredRole) {
  const withPassword = candidates.filter((u) => {
    try {
      return bcrypt.compareSync(password, u.password);
    } catch {
      return false;
    }
  });
  if (!withPassword.length) return null;
  if (preferredRole) {
    const byRole = withPassword.find((u) => u.role === preferredRole);
    if (byRole) return byRole;
  }
  // Prefer field staff for mobile-style logins when multiple passwords somehow match
  const fo = withPassword.find((u) => u.role === 'fieldOfficer');
  return fo || withPassword[0];
}

exports.login = (req, res) => {
  const loginId = resolveLoginId(req.body);
  const password = req.body.password;
  const role = req.body.role; // optional legacy — not required

  if (!loginId || !password) {
    return error(res, 'Login ID and password required');
  }

  const candidates = findByLoginId(loginId);
  if (!candidates.length) {
    return error(res, 'Invalid Login ID or password', 401);
  }

  const user = pickUser(candidates, password, role || null);
  if (!user) {
    return error(res, 'Invalid Login ID or password', 401);
  }
  if (user.isActive === false) {
    return error(res, 'Account is disabled. Contact admin.', 403);
  }

  if (user.role !== 'superAdmin' && companyFor(user)?.isActive !== true) return error(res, 'Company is suspended or unavailable', 403);
  const token = generateToken(user);
  return success(res, { ...sanitizeUser(user), token }, 'Login successful');
};

exports.sendOtp = (req, res) => {
  if (process.env.ENABLE_DEMO_OTP !== 'true') return error(res, 'OTP login is unavailable. Use your password.', 403);
  const loginId = resolveLoginId(req.body);
  if (!loginId || loginId.length < 3) {
    return error(res, 'Valid Login ID or mobile required');
  }
  const candidates = findByLoginId(loginId).filter(u => u.role !== 'superAdmin' && companyFor(u)?.isActive === true);
  if (!candidates.length) {
    return error(res, 'User not found', 404);
  }
  return success(res, { otpSent: true, demoOtp: DEMO_OTP }, 'OTP sent (demo: 123456)');
};

exports.verifyOtp = (req, res) => {
  if (process.env.ENABLE_DEMO_OTP !== 'true') return error(res, 'OTP login is unavailable. Use your password.', 403);
  const loginId = resolveLoginId(req.body);
  const { otp, role } = req.body;

  if (otp !== DEMO_OTP) {
    return error(res, 'Invalid OTP', 401);
  }

  const candidates = findByLoginId(loginId).filter(u => u.role !== 'superAdmin' && companyFor(u)?.isActive === true);
  if (!candidates.length) {
    return error(res, 'User not found', 404);
  }

  let user = null;
  if (role) {
    user = candidates.find((u) => u.role === role);
  }
  if (!user) {
    user = candidates.find((u) => u.role === 'fieldOfficer') || candidates[0];
  }
  if (user.isActive === false) {
    return error(res, 'Account is disabled. Contact admin.', 403);
  }

  const token = generateToken(user);
  return success(res, { ...sanitizeUser(user), token }, 'OTP verified');
};

exports.me = (req, res) => {
  return success(res, sanitizeUser(req.user));
};

exports.logout = (req, res) => {
  return success(res, null, 'Logged out');
};

exports.changePassword = (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const minimum = req.user.role === 'superAdmin' ? 8 : 4;
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < minimum) {
    return error(res, `Valid old and new password required (min ${minimum} chars)`);
  }

  const users = getCollection('users');
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return error(res, 'User not found', 404);

  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return error(res, 'Current password is wrong', 401);
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  upsert('users', user);
  return success(res, null, 'Password changed successfully');
};

exports.updateProfile = (req, res) => {
  const { name, photoUrl } = req.body;
  const users = getCollection('users');
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return error(res, 'User not found', 404);

  if (name) user.name = name;
  if (photoUrl) user.photoUrl = photoUrl;

  upsert('users', user);
  return success(res, sanitizeUser(user), 'Profile updated');
};
