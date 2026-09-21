export const PERMISSION_LABELS = {
  dashboard: 'Dashboard',
  customerListings: 'Customer Listing',
  customers: 'Customers',
  attendance: 'Attendance',
  tracking: 'GPS Tracking',
  callLogs: 'Call Logs',
  users: 'User management',
  branches: 'Locations',
};

export function getUserPermissions(user) {
  return user?.permissions || {};
}

export function canAccess(user, key) {
  const p = getUserPermissions(user);
  return p[key] === true;
}

export function filterNavByPermissions(items, user) {
  return items.filter((item) => {
    if (!item.permission) return true;
    return canAccess(user, item.permission);
  });
}
