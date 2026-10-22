const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { MODULES, ACTIONS, MODULE_ACTIONS, allModules, allActions } = require('../../lib/companyPolicy');
const { effectivePermissions, ROLE_DEFAULTS } = require('../../lib/rbac');
const router = express.Router();
router.use(authMiddleware, requireRole('superAdmin'));
const id = prefix => `${prefix}_${randomUUID()}`;
const text = value => String(value || '').trim();
const now = () => new Date().toISOString();
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function audit(req, action, companyId, targetId) {
  upsert('platformAudit', { id: id('AUD'), actorId: req.user.id, actorName: req.user.name,
    action, companyId, targetId, createdAt: now() }, { single: true });
}
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
function company(id) { const c = findById('companies', id); if (!c) fail('Company not found', 404); return c; }
function cleanModules(input, base = allModules()) {
  const result = { ...base };
  for (const key of Object.keys(MODULES)) {
    if (input?.[key] !== undefined) {
      if (typeof input[key] !== 'boolean') fail(`Invalid page permission: ${key}`);
      result[key] = input[key];
    }
  }
  return result;
}
function cleanActions(input, base = allActions()) {
  const result = structuredClone(base);
  for (const key of Object.keys(MODULES)) for (const action of Object.keys(ACTIONS)) {
    if (input?.[key]?.[action] !== undefined) {
      if (typeof input[key][action] !== 'boolean') fail(`Invalid function permission: ${key}.${action}`);
      result[key] ||= {};
      result[key][action] = input[key][action];
    }
  }
  return result;
}
function assertLoginAvailable(values, exceptId) {
  const needles = values.map(v => text(v).toLowerCase()).filter(Boolean);
  if (getCollection('users').some(u => u.id !== exceptId && [u.email, u.employeeId, u.mobile].some(v => needles.includes(text(v).toLowerCase())))) {
    fail('Email, employee ID or mobile is already used by another account', 409);
  }
}
function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email || '', employeeId: u.employeeId, mobile: u.mobile || '',
    companyId: u.companyId, role: u.role, branch: u.branch || '', isActive: u.isActive !== false,
    permissions: u.platformPermissions || u.permissions || ROLE_DEFAULTS[u.role], effectivePermissions: effectivePermissions(u), actions: u.platformActions || allActions() };
}
function companySummary(c) {
  const users = getCollection('users').filter(u => u.companyId === c.id && u.role !== 'superAdmin');
  return { ...c, employeeCount: users.length, activeEmployeeCount: users.filter(u => u.isActive !== false).length,
    branchCount: getCollection('branches').filter(b => b.companyId === c.id).length };
}

router.get('/overview', wrap(async (req, res) => {
  const companies = getCollection('companies').map(companySummary);
  return success(res, { companies, modules: MODULES, actions: ACTIONS, moduleActions: MODULE_ACTIONS,
    roleDefaults: ROLE_DEFAULTS, audit: getCollection('platformAudit').slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40) });
}));
router.post('/companies', wrap(async (req, res) => {
  const body = req.body;
  const name = text(body.name), code = text(body.code).toUpperCase();
  if (!name || name.length > 120 || !/^[A-Z0-9_-]{2,20}$/.test(code)) fail('Company name and a unique 2–20 character company code are required');
  if (getCollection('companies').some(c => c.code === code)) fail('Company code already exists', 409);
  const adminName = text(body.adminName), email = text(body.adminEmail).toLowerCase();
  if (!adminName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof body.adminPassword !== 'string' || body.adminPassword.length < 8) fail('Administrator name, valid email and password of at least 8 characters are required');
  assertLoginAvailable([email, body.adminMobile]);
  const c = { id: id('CO'), name, code, email: text(body.email), isActive: true,
    modules: cleanModules(body.modules), actions: cleanActions(body.actions), createdAt: now(), updatedAt: now() };
  const admin = { id: id('U'), companyId: c.id, name: adminName, email, employeeId: email,
    mobile: text(body.adminMobile), role: 'admin', branch: null, isActive: true,
    password: bcrypt.hashSync(body.adminPassword, 12), createdAt: now(), createdBy: req.user.id };
  upsert('companies', c, { single: true });
  upsert('users', admin, { single: true });
  audit(req, 'Company created with administrator', c.id, admin.id);
  await flush();
  return success(res, companySummary(c), 'Company and administrator created', 201);
}));
router.put('/companies/:id', wrap(async (req, res) => {
  const current = company(req.params.id), b = req.body;
  if (b.name !== undefined && (!text(b.name) || text(b.name).length > 120)) fail('Valid company name required');
  if (b.isActive !== undefined && typeof b.isActive !== 'boolean') fail('Invalid company status');
  const next = { ...current, name: b.name === undefined ? current.name : text(b.name),
    email: b.email === undefined ? current.email : text(b.email),
    isActive: b.isActive === undefined ? current.isActive : b.isActive,
    modules: cleanModules(b.modules, current.modules), actions: cleanActions(b.actions, current.actions), updatedAt: now() };
  upsert('companies', next, { single: true });
  audit(req, 'Company settings and access updated', next.id, next.id);
  await flush(); return success(res, companySummary(next), 'Company updated');
}));
router.get('/companies/:id/users', wrap(async (req, res) => {
  company(req.params.id);
  return success(res, { users: getCollection('users').filter(u => u.companyId === req.params.id && u.role !== 'superAdmin').map(safeUser),
    branches: getCollection('branches').filter(b => b.companyId === req.params.id).map(b => ({ id: b.id, name: b.name })) });
}));
router.post('/companies/:id/users', wrap(async (req, res) => {
  const c = company(req.params.id), b = req.body;
  const role = b.role || 'fieldOfficer';
  if (!ROLE_DEFAULTS[role] || !Object.hasOwn(ROLE_DEFAULTS, role)) fail('Invalid company role');
  const name = text(b.name), login = text(b.employeeId), email = text(b.email).toLowerCase();
  if (!name || !login || typeof b.password !== 'string' || b.password.length < 8) fail('Name, login ID and password of at least 8 characters are required');
  if (b.isActive !== undefined && typeof b.isActive !== 'boolean') fail('Invalid account status');
  if (role !== 'admin' && !getCollection('branches').some(x => x.companyId === c.id && x.name === b.branch && x.isActive !== false)) fail('Choose an active company location');
  assertLoginAvailable([login, email, b.mobile]);
  const user = { id: id('U'), companyId: c.id, name, employeeId: login, email, mobile: text(b.mobile), role,
    branch: text(b.branch) || null, password: bcrypt.hashSync(b.password, 12), isActive: b.isActive !== false,
    permissions: cleanModules(b.permissions, ROLE_DEFAULTS[role]), platformPermissions: cleanModules(b.permissions, ROLE_DEFAULTS[role]), platformActions: cleanActions(b.actions), createdAt: now(), createdBy: req.user.id };
  upsert('users', user, { single: true }); audit(req, 'Company user created', c.id, user.id);
  await flush(); return success(res, safeUser(user), 'User created', 201);
}));
router.put('/companies/:id/users/:userId', wrap(async (req, res) => {
  const c = company(req.params.id), current = findById('users', req.params.userId), b = req.body;
  if (!current || current.companyId !== c.id || current.role === 'superAdmin') fail('Company user not found', 404);
  const next = { ...current };
  if (b.role !== undefined) { if (!Object.hasOwn(ROLE_DEFAULTS, b.role)) fail('Invalid company role'); next.role = b.role; }
  if (b.name !== undefined) { if (!text(b.name)) fail('Name is required'); next.name = text(b.name); }
  if (b.isActive !== undefined) { if (typeof b.isActive !== 'boolean') fail('Invalid account status'); next.isActive = b.isActive; }
  if (b.branch !== undefined) {
    if (next.role !== 'admin' && !getCollection('branches').some(x => x.companyId === c.id && x.name === b.branch)) fail('Choose an existing company location');
    next.branch = text(b.branch) || null;
  }
  if (next.role !== 'admin' && !getCollection('branches').some(x => x.companyId === c.id && x.name === next.branch && x.isActive !== false)) fail('Choose an active company location');
  if (b.password) { if (typeof b.password !== 'string' || b.password.length < 8) fail('Password must contain at least 8 characters'); next.password = bcrypt.hashSync(b.password, 12); }
  next.platformPermissions = cleanModules(b.permissions, b.role && b.role !== current.role ? ROLE_DEFAULTS[next.role] : current.platformPermissions || current.permissions || ROLE_DEFAULTS[next.role]);
  next.platformActions = cleanActions(b.actions, current.platformActions || allActions());
  // Preserve at least one active company administrator.
  if (current.role === 'admin' && current.isActive !== false && (next.role !== 'admin' || next.isActive === false) &&
    !getCollection('users').some(u => u.companyId === c.id && u.id !== current.id && u.role === 'admin' && u.isActive !== false)) fail('Keep at least one active company administrator');
  next.permissions = { ...next.permissions, ...next.platformPermissions };
  next.updatedAt = now(); upsert('users', next, { single: true }); audit(req, 'Company user access updated', c.id, next.id);
  await flush(); return success(res, safeUser(next), 'User updated');
}));
module.exports = router;
