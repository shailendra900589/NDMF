/**
 * AUTH CONTROLLER
 * ---------------
 * Login, OTP verify - Flutter app aur React admin dono use karenge.
 *
 * Demo credentials — see DEMO_LOGINS.md:
 *   Admin 9000000001 | BM 9000000002 | FO 9000000003 | Password: ndfa1234 | OTP: 123456
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { findById, getCollection, upsert } = require('../../lib/db');
const { jwtSecret } = require('../../config/env');
const { success, error } = require('../../lib/response');

const DEMO_OTP = '123456';

function generateToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

const { effectivePermissions } = require('../../lib/rbac');

function sanitizeUser(user) {
  const { password, ...safe } = user;
  safe.permissions = effectivePermissions(user);
  return safe;
}

exports.login = (req, res) => {
  const { mobile, password, role } = req.body;

  if (!mobile || !password) {
    return error(res, 'Mobile and password required');
  }

  const users = getCollection('users');
  const candidates = users.filter((u) => u.mobile === mobile);
  if (!candidates.length) {
    return error(res, 'Invalid mobile number', 401);
  }

  let user = null;
  if (role) {
    user = candidates.find((u) => u.role === role);
  } else if (candidates.length === 1) {
    user = candidates[0];
  } else {
    return error(res, 'Multiple roles on this mobile — select role', 400);
  }

  if (!user) {
    return error(res, 'Invalid role for this mobile', 401);
  }
  if (user.isActive === false) {
    return error(res, 'Account is disabled. Contact admin.', 403);
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return error(res, 'Wrong password', 401);
  }

  const token = generateToken(user);
  return success(res, { ...sanitizeUser(user), token }, 'Login successful');
};

exports.sendOtp = (req, res) => {
  const { mobile } = req.body;
  if (!mobile || mobile.length < 10) {
    return error(res, 'Valid mobile number required');
  }
  // Demo: OTP hamesha 123456 (production me SMS gateway lagayenge)
  return success(res, { otpSent: true, demoOtp: DEMO_OTP }, 'OTP sent (demo: 123456)');
};

exports.verifyOtp = (req, res) => {
  const { mobile, otp, role } = req.body;

  if (otp !== DEMO_OTP) {
    return error(res, 'Invalid OTP', 401);
  }

  const users = getCollection('users');
  const user = users.find((u) => u.mobile === mobile && u.role === (role || 'fieldOfficer'));

  if (!user) {
    return error(res, 'User not found', 404);
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
  if (!oldPassword || !newPassword || newPassword.length < 4) {
    return error(res, 'Valid old and new password required (min 4 chars)');
  }

  const bcrypt = require('bcryptjs');
  const { getCollection, upsert } = require('../../lib/db');
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
