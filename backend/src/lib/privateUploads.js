const crypto = require('node:crypto');
const path = require('node:path');
const { jwtSecret } = require('../config/env');
const { context } = require('./tenantContext');
const { ownsUpload } = require('./uploadOwnership');
function signature(filename, userId, expires, module) {
  return crypto.createHmac('sha256', jwtSecret).update(JSON.stringify([filename, userId, expires, module])).digest('hex');
}
function signMedia(data) {
  const scope = context.getStore();
  if (!scope?.userId) return data;
  if (Array.isArray(data)) return data.map(signMedia);
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).map(([k,v]) => [k, signMedia(v)]));
  if (typeof data !== 'string') return data;
  const match = data.match(/^(?:https?:\/\/[^/]+)?\/uploads\/([^\s/?#]+)(?:[?#].*)?$/);
  if (!match) return data;
  const filename = match[1];
  if (!ownsUpload(filename, scope.companyId)) return null;
  const expires = String(Math.floor(Date.now() / 1000) + 86400);
  const module = scope.mediaModule || 'profile';
  const params = new URLSearchParams({ user: scope.userId, expires, module, signature: signature(filename, scope.userId, expires, module) });
  return `/uploads/${filename}?${params}`;
}
function privateUploadAccess(req, res, next) {
  const { findById } = require('./db');
  const { companyFor } = require('./companyPolicy');
  const { hasPermission } = require('./rbac');
  const filename = path.basename(req.path);
  const { user: userId, expires, module, signature: supplied } = req.query;
  if (![userId, expires, module, supplied].every(v => typeof v === 'string')) return res.sendStatus(403);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000 || !/^[0-9a-f]{64}$/.test(supplied)) return res.sendStatus(403);
  const expected = signature(filename, userId, expires, module);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return res.sendStatus(403);
  const user = findById('users', userId);
  if (!user || user.isActive === false || companyFor(user)?.isActive !== true || !ownsUpload(filename, user.companyId)) return res.sendStatus(403);
  if (module !== 'profile' && !hasPermission(user, module)) return res.sendStatus(403);
  res.setHeader('Cache-Control', 'private, no-store');
  return next();
}
module.exports = { signMedia, privateUploadAccess };
