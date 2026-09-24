const ROLE_DEFAULTS = {
  admin: {
    dashboard: true,
    customers: true,
    attendance: true,
    tracking: true,
    callLogs: true,
    users: true,
    branches: true,
    payslips: true,
  },
  branchManager: {
    dashboard: true,
    customers: true,
    attendance: true,
    tracking: true,
    callLogs: true,
    users: true,
    branches: false,
    payslips: false,
  },
  fieldOfficer: {
    dashboard: true,
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
  dashboard: 'Dashboard',
  customers: 'Customers',
  attendance: 'Attendance',
  tracking: 'GPS Tracking',
  callLogs: 'Call Logs',
  users: 'User management',
  branches: 'Locations',
  payslips: 'Pay Slips',
};

export function getUserPermissions(user) {
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
