const { hasPermission } = require('../lib/rbac');
const { error } = require('../lib/response');

function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'Login required', 401);
    if (!hasPermission(req.user, key)) {
      return error(res, 'You do not have permission to access this module', 403);
    }
    next();
  };
}

module.exports = { requirePermission };
