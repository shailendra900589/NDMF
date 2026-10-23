const { getCollection, upsert, flush, COLLECTIONS } = require('./db');
const { DEFAULT_COMPANY_ID, GLOBAL_COLLECTIONS } = require('./tenantContext');
const { allModules, allActions } = require('./companyPolicy');

// Initial credential is stored only as a bcrypt hash. Existing passwords are never reset on restart.
const INITIAL_PASSWORD_HASH = '$2a$12$YJ8tWSKliLGTqrRRyezrNepKS6ZnNCI9NZ6zxk0d5oG8U1tZsBxOi';
async function bootstrapPlatform() {
  const now = new Date().toISOString();
  const oldBrand = value => ['nirmaldhara micro foundation', 'nirmaldhara micro finance', 'nirmaldhara']
    .includes(String(value || '').trim().toLowerCase());
  const existingCompany = getCollection('companies').find(c => c.id === DEFAULT_COMPANY_ID);
  if (existingCompany && oldBrand(existingCompany.name)) {
    upsert('companies', { ...existingCompany, name: 'Smartstaff plus', updatedAt: now }, { single: true });
  }
  if (!getCollection('companies').some(c => c.id === DEFAULT_COMPANY_ID)) {
    upsert('companies', { id: DEFAULT_COMPANY_ID, name: 'Smartstaff plus', code: 'NDFA',
      email: '', isActive: true, modules: allModules(), actions: allActions(), createdAt: now }, { single: true });
  }
  for (const name of COLLECTIONS.filter(n => !GLOBAL_COLLECTIONS.has(n))) {
    for (const item of [...getCollection(name)]) {
      if (item.role === 'superAdmin' || item.companyId) continue;
      item.companyId = DEFAULT_COMPANY_ID;
      if (name === 'appSettings' && item.id === 'global') {
        // Keep the old key as a migration marker; scoped readers use the company key.
        upsert(name, { ...item, id: `settings_${DEFAULT_COMPANY_ID}` }, { single: true });
      }
      upsert(name, item, { single: true });
    }
  }
  for (const slip of getCollection('payslips')) {
    if (slip.companyId === DEFAULT_COMPANY_ID && oldBrand(slip.companyName)) {
      upsert('payslips', { ...slip, companyName: 'Smartstaff plus' }, { single: true });
    }
  }
  const login = 'ajitndfa@ndclients.co.in';
  const existing = getCollection('users').find(u => u.role === 'superAdmin' && u.email === login);
  if (!existing) {
    if (getCollection('users').some(u => u.id === 'U_PLATFORM_AJIT')) throw new Error('Reserved Super Admin ID is already in use');
    if (getCollection('users').some(u => [u.email, u.employeeId, u.mobile].some(v => String(v || '').toLowerCase() === login))) {
      throw new Error('Reserved Super Admin login is already in use');
    }
    upsert('users', { id: 'U_PLATFORM_AJIT', name: 'Ajit', email: login, employeeId: login,
      role: 'superAdmin', companyId: null, password: INITIAL_PASSWORD_HASH, isActive: true, createdAt: now }, { single: true });
  }
  await flush();
}
module.exports = { bootstrapPlatform };
