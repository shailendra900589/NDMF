/**
 * AUTH MIDDLEWARE
 * ---------------
 * JWT token verify karta hai.
 * Protected routes par lagaya jata hai.
 *
 * Header: Authorization: Bearer <token>
 */
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { findById } = require('../lib/db');
const { error } = require('../lib/response');
const { context } = require('../lib/tenantContext');
const { companyFor } = require('../lib/companyPolicy');
const { enforceCompanyAccess } = require('./companyAccess');

function authMiddleware(req, res, next) {
  if (req.user) return next();
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Login required. Token missing.', 401);
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = findById('users', decoded.userId);
    if (!user) return error(res, 'User not found', 401);
    if (user.isActive === false) return error(res, 'Account disabled', 403);
    if (user.role !== 'superAdmin' && companyFor(user)?.isActive !== true) return error(res, 'Company is suspended or unavailable', 403);
    req.user = user;
    const proceed = () => enforceCompanyAccess(req, res, next);
    return user.role === 'superAdmin' ? proceed() : context.run({ companyId: user.companyId, userId: user.id }, proceed);
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

/** Sirf specific roles ke liye */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, 'You do not have permission for this action', 403);
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
