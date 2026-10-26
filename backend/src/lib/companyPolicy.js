const MODULES = {
  notices: 'Notice & Announcement', visits: 'Visit schedules',
  dashboard: 'Dashboard', customerListings: 'Customer listings', customers: 'Customers',
  attendance: 'Attendance', tracking: 'GPS tracking', callLogs: 'Call logs',
  users: 'Employee & Permission', branches: 'Branch Management', payslips: 'Payroll',
};
const ACTIONS = { create: 'Create / submit', update: 'Edit / update', delete: 'Delete / reset', approve: 'Approve / assign', export: 'Export / download' };
const MODULE_ACTIONS = { notices: ['create'], visits: ['create','update'], dashboard: [], customerListings: ['create','approve','export'], customers: ['create','export'],
  attendance: ['create','update','export'], tracking: ['create'], callLogs: ['create','update'],
  users: ['create','update','delete'], branches: ['create','update','delete'], payslips: ['create','update','delete','export'] };
const allModules = () => Object.fromEntries(Object.keys(MODULES).map(k => [k, true]));
const allActions = () => Object.fromEntries(Object.keys(MODULES).map(k => [k, Object.fromEntries(Object.keys(ACTIONS).map(a => [a, true]))]));
function companyFor(user) {
  if (!user?.companyId) return null;
  return require('./db').getCollection('companies').find(c => c.id === user.companyId) || null;
}
function actionAllowed(user, module, action) {
  const company = companyFor(user);
  return company?.isActive === true && company.modules?.[module] !== false &&
    company.actions?.[module]?.[action] !== false && user.platformActions?.[module]?.[action] !== false;
}
module.exports = { MODULES, ACTIONS, MODULE_ACTIONS, allModules, allActions, companyFor, actionAllowed };
