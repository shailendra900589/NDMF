/** UI copy — hide the word "Branch" from labels/locations/names */

export function displayLocation(name) {
  if (!name) return '—';
  return String(name)
    .replace(/\bBranches?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || '—';
}

export function displayPersonName(name) {
  return displayLocation(name);
}

export function displayRole(role) {
  if (role === 'branchManager') return 'Manager';
  if (role === 'fieldOfficer') return 'Employee';
  if (role === 'admin') return 'Administrator';
  return role || '—';
}

export function displayRoleShort(role) {
  if (role === 'branchManager') return 'Mgr';
  if (role === 'fieldOfficer') return 'Emp';
  if (role === 'admin') return 'Adm';
  return role || '—';
}
