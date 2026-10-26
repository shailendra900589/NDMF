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

export const PERMISSION_LABELS = {
  notices: 'Notice & Announcement', visits: 'Visit schedules',
  dashboard: 'Dashboard',
  customerListings: 'Customer Listing',
  customers: 'Customers',
  attendance: 'Attendance',
  tracking: 'Live GPS tracking (team map)',
  callLogs: 'Call Logs',
  users: 'Employee & Permission',
  branches: 'Branch Management',
  payslips: 'Payroll',
};

export function getUserPermissions(user) {
  if (user?.role === 'superAdmin') return Object.fromEntries(Object.keys(ROLE_DEFAULTS.admin).map(k => [k, false]));
  const base = { ...(ROLE_DEFAULTS[user?.role] || ROLE_DEFAULTS.fieldOfficer) };
  const stored = user?.permissions;
  if (stored && typeof stored === 'object') {
    Object.keys(base).forEach((k) => {
      if (typeof stored[k] === 'boolean') base[k] = stored[k];
    });
  }
  return base;
}

export function canAccess(user, key) {
  return getUserPermissions(user)[key] === true;
}

export function filterNavByPermissions(items, user) {
  return items.filter((item) => {
    if (!item.permission) return true;
    return canAccess(user, item.permission);
  });
}

export function canPerformStored(module, action) {
  try {
    const user = JSON.parse(localStorage.getItem('ndfa_user') || '{}');
    return canAccess(user, module) && user.actions?.[module]?.[action] !== false;
  } catch { return false; }
}
