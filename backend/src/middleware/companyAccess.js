const { hasPermission } = require('../lib/rbac');
const { actionAllowed } = require('../lib/companyPolicy');
const { error } = require('../lib/response');
const modulePaths = { dashboard: 'dashboard', customers: 'customers', 'customer-listings': 'customerListings',
  attendance: 'attendance', tracking: 'tracking', 'call-logs': 'callLogs', users: 'users',
  branches: 'branches', payslips: 'payslips', media: 'callLogs' };

function enforceCompanyAccess(req, res, next) {
  const route = (req.originalUrl || '').split('?')[0].replace(/^\/api\/v1\//, '');
  if (req.user.role === 'superAdmin') {
    if (!/^(super-admin|auth)(\/|$)/.test(route) && !/^developer\/manage(\/|$)/.test(route)) return error(res, 'Use the Super Admin company console', 403);
    return next();
  }
  if (/^super-admin(\/|$)/.test(route)) return error(res, 'Super Admin access required', 403);
  if (/^auth(\/|$)/.test(route) || route === 'settings/public') return next();
  if (route === 'payslips/mine' && req.method === 'GET') return next();
  // Branch lookups and own enrollment support other enabled modules without granting management access.
  if (req.method === 'GET' && route === 'branches') return next();
  if (/^users\/me\/face-enrollment$/.test(route)) {
    return hasPermission(req.user, 'attendance') && (req.method === 'GET' || actionAllowed(req.user, 'attendance', 'create')) ? next() : error(res, 'Attendance is disabled', 403);
  }
  if (route === 'users/permission-schema') return hasPermission(req.user, 'users') ? next() : error(res, 'Users module is disabled', 403);
  if (/^workspace\/notices(?:\/|$)/.test(route)) {
    if (!hasPermission(req.user,'notices')) return error(res,'Notices are disabled',403);
    if (req.method==='GET' || /\/acknowledge$/.test(route)) return next();
    return actionAllowed(req.user,'notices','create') ? next() : error(res,'Notice publishing is disabled',403);
  }
  if (/^uploads\//.test(route)) {
    return ['customerListings', 'customers', 'attendance', 'callLogs', 'users'].some(k => hasPermission(req.user, k) && actionAllowed(req.user, k, 'create'))
      ? next() : error(res, 'File uploads are disabled for this account', 403);
  }
  const module = /^workspace\/visits(?:\/|$)/.test(route) ? 'visits' : /^settings\/attendance-(face|timing)$/.test(route) ? 'attendance' : modulePaths[route.split('/')[0]];
  if (!module || !hasPermission(req.user, module)) return error(res, 'This page is disabled for your company or account', 403);
  require('../lib/tenantContext').context.getStore().mediaModule = module;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (route === 'payslips/bulk' && req.method === 'POST') {
    return ['create', 'update'].some(a => actionAllowed(req.user, module, a)) ? next() : error(res, 'Pay slip changes are disabled', 403);
  }
  const action = /\/(approve|assign)(\/|$)/.test(route) ? 'approve' : req.method === 'DELETE' ? 'delete'
    : ['PUT', 'PATCH'].includes(req.method) ? 'update' : 'create';
  return actionAllowed(req.user, module, action) ? next() : error(res, 'This function is disabled by Super Admin', 403);
}
module.exports = { enforceCompanyAccess };
