/**
 * RBAC — branch scope + module permissions
 */
const PERMISSION_KEYS = [
  'notices', 'visits',
  'dashboard',
  'customerListings',
  'customers',
  'attendance',
  'tracking',
  'callLogs',
  'users',
  'branches',
  'payslips',
];

const ROLE_DEFAULTS = {
  admin: {
    notices: true, visits: true,
    dashboard: true,
    customerListings: true,
    customers: true,
    attendance: true,
    tracking: true,
    callLogs: true,
    users: true,
    branches: true,
    payslips: true,
  },
  branchManager: {
    notices: true, visits: true,
    dashboard: true,
    customerListings: true,
    customers: true,
    attendance: true,
    tracking: true,
    callLogs: true,
    users: true,
    branches: false,
    payslips: false,
  },
  fieldOfficer: {
    notices: true, visits: true,
    dashboard: true,
    customerListings: true,
    customers: true,
    attendance: true,
    tracking: true,
    callLogs: true,
    users: false,
    branches: false,
    payslips: false,
  },
};

function isAdmin(user) {
  return user?.role === 'admin';
}

function effectivePermissions(user) {
  const base = { ...(ROLE_DEFAULTS[user?.role] || ROLE_DEFAULTS.fieldOfficer) };
  if (user?.permissions && typeof user.permissions === 'object') {
    PERMISSION_KEYS.forEach((k) => {
      if (typeof user.permissions[k] === 'boolean') base[k] = user.permissions[k];
    });
  }
  const company = require('./companyPolicy').companyFor(user);
  PERMISSION_KEYS.forEach(k => { if (!company || company.isActive !== true || company.modules?.[k] === false || user?.platformPermissions?.[k] === false) base[k] = false; });
  return base;
}

function hasPermission(user, key) {
  return effectivePermissions(user)[key] === true;
}

/** Admin: all branches. Other staff may have a primary branch plus assigned branches. */
function sameBranch(user, recordBranch) {
  if (isAdmin(user)) return true;
  if (!recordBranch) return false;
  const allowed = [user?.branch, ...(Array.isArray(user?.branches) ? user.branches : [])]
    .filter(Boolean).map(value => String(value).trim().toLowerCase());
  return allowed.includes(String(recordBranch).trim().toLowerCase());
}

function filterByBranch(records, user, branchKey = 'branch') {
  if (isAdmin(user)) return records;
  return records.filter((r) => sameBranch(user, r[branchKey]));
}

function filterByBranchViaUser(records, user, users) {
  if (isAdmin(user)) return records;
  const userBranch = (uid) => {
    const u = users.find((x) => x.id === uid || x.employeeId === uid);
    return u?.branch;
  };
  return records.filter((r) => {
    const b = r.branch || userBranch(r.userId) || userBranch(r.employeeId) || userBranch(r.createdBy);
    return sameBranch(user, b);
  });
}

/** Users list on admin panel */
function listUsersVisibleTo(actor, allUsers) {
  if (isAdmin(actor)) return allUsers;
  if (actor.role === 'branchManager') {
    return allUsers.filter(
      (u) => u.role === 'fieldOfficer' && sameBranch(actor, u.branch)
    );
  }
  return [];
}

function canManageUser(actor, target) {
  if (target.role === 'superAdmin' || actor.companyId !== target.companyId) return false;
  if (!hasPermission(actor, 'users')) return false;
  if (isAdmin(actor)) return true;
  if (actor.role === 'branchManager') {
    if (target.role === 'admin' || target.role === 'branchManager') return false;
    if (target.role === 'fieldOfficer') return sameBranch(actor, target.branch);
  }
  return false;
}

/** BM/Admin: module keys they may assign to employees */
function assignablePermissionKeys(actor) {
  // Page/function entitlements are managed exclusively by the platform console.
  return [];
}

function allowedRolesForCreator(creator) {
  if (creator.role === 'admin') return ['fieldOfficer', 'branchManager', 'admin'];
  if (creator.role === 'branchManager') return ['fieldOfficer'];
  return [];
}

module.exports = {
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  isAdmin,
  effectivePermissions,
  hasPermission,
  sameBranch,
  filterByBranch,
  filterByBranchViaUser,
  canManageUser,
  listUsersVisibleTo,
  assignablePermissionKeys,
  allowedRolesForCreator,
};
