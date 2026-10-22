const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

// Exercise the real HTTP routes and database cache against an isolated PostgreSQL adapter.
// This test never opens a production database connection.
const rows = new Map();
const legacy = { id: 'LEGACY_ADMIN', name: 'Existing administrator', mobile: '9000000001', employeeId: 'ADM001', role: 'admin', password: bcrypt.hashSync('LegacyTest432!', 4), isActive: true };
rows.set('users:LEGACY_ADMIN', { collection: 'users', id: legacy.id, data: legacy });
rows.set('customers:C_OLD', { collection: 'customers', id: 'C_OLD', data: { id: 'C_OLD', name: 'Original customer', mobile: '9999999999' } });
async function query(sql, args) {
  if (/SELECT collection/.test(sql)) return { rows: [...rows.values()].map(r => structuredClone(r)) };
  if (/INSERT INTO ndfa_docs/.test(sql)) rows.set(`${args[0]}:${args[1]}`, { collection: args[0], id: args[1], data: JSON.parse(args[2]) });
  if (/DELETE FROM ndfa_docs/.test(sql)) for (const [key, r] of rows) if (r.collection === args[0]) rows.delete(key);
  return { rows: [] };
}
require.cache[require.resolve('../src/lib/pg')] = { exports: { query, getPool: () => ({ connect: async () => ({ query, release() {} }) }) } };
const db = require('../src/lib/db');
const { context, DEFAULT_COMPANY_ID } = require('../src/lib/tenantContext');
const { bootstrapPlatform } = require('../src/lib/platformBootstrap');

test('Super Admin lifecycle, company isolation and live permission enforcement', async t => {
  await db.initDb(); await bootstrapPlatform();
  const firstHash = db.findById('users', 'U_PLATFORM_AJIT').password;
  await bootstrapPlatform();
  assert.equal(db.getCollection('users').filter(u => u.role === 'superAdmin').length, 1);
  assert.equal(db.findById('users', 'U_PLATFORM_AJIT').password, firstHash);
  assert.equal(db.findById('customers', 'C_OLD').companyId, DEFAULT_COMPANY_ID);
  const server = require('../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  async function call(path, method = 'GET', body, token) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, ...(await r.json()) };
  }
  async function login(loginId, password) {
    const r = await call('/auth/login', 'POST', { loginId, password }); assert.equal(r.status, 200, r.message); return r.data.token;
  }
  await t.test('same login accepts reserved email and only its password', async () => {
    assert.equal((await call('/auth/login', 'POST', { loginId:'ajitndfa@ndclients.co.in', password:'wrong' })).status, 401);
    assert.equal((await call('/super-admin/overview')).status, 401);
  });
  const sa = await login('AJITNDFA@ndclients.co.in', 'AjitNDFA@4324');
  const old = await login('ADM001', 'LegacyTest432!');
  await t.test('company admins cannot reach platform endpoints or modify platform account', async () => {
    assert.equal((await call('/super-admin/overview', 'GET', undefined, old)).status, 403);
    assert.equal((await call('/users/U_PLATFORM_AJIT', 'PUT', { role:'admin' }, old)).status, 404);
    assert.equal((await call('/customers', 'GET', undefined, sa)).status, 403);
  });
  let co, admin;
  await t.test('create company and email administrator, reject duplicate login', async () => {
    const r = await call('/super-admin/companies', 'POST', { name:'Second Company', code:'SECOND', adminName:'Company owner', adminEmail:'owner@example.test', adminPassword:'CompanyTest432!' }, sa);
    assert.equal(r.status, 201, r.message); co = r.data;
    admin = await login('owner@example.test', 'CompanyTest432!');
    const dup = await call('/super-admin/companies', 'POST', { name:'Duplicate', code:'DUP', adminName:'Other', adminEmail:'owner@example.test', adminPassword:'CompanyTest432!' }, sa);
    assert.equal(dup.status, 409);
  });
  let customer;
  await t.test('existing data is private and create ignores forged companyId', async () => {
    assert.equal((await call('/customers', 'GET', undefined, admin)).data.length, 0);
    assert.equal((await call('/customers/C_OLD', 'GET', undefined, admin)).status, 404);
    const r = await call('/customers', 'POST', { name:'Second customer', mobile:'8888888888', companyId:DEFAULT_COMPANY_ID }, admin);
    assert.equal(r.status, 201, r.message); customer = r.data;
    assert.equal(customer.companyId, co.id);
    assert.equal((await call(`/customers/${customer.id}`, 'GET', undefined, old)).status, 404);
    const results = await Promise.all(Array.from({length:16}, (_, i) => call('/customers', 'GET', undefined, i % 2 ? admin : old)));
    results.forEach((r,i) => assert.deepEqual(r.data.map(c => c.id), [i % 2 ? customer.id : 'C_OLD']));
  });
  await t.test('uploaded documents require a valid signed link and company ownership', async () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const filename = `${co.id}_${require('node:crypto').randomUUID()}.txt`;
    const file = path.join(__dirname, '../uploads', filename);
    fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, 'private company document');
    t.after(() => fs.unlinkSync(file));
    const owner = db.getCollection('users').find(u => u.companyId === co.id);
    const { signMedia } = require('../src/lib/privateUploads');
    const url = context.run({ companyId:co.id, userId:owner.id, mediaModule:'customers' }, () => signMedia(`/uploads/${filename}`));
    const origin = base.replace('/api/v1','');
    assert.equal((await fetch(origin + `/uploads/${filename}`)).status, 403);
    const r = await fetch(origin + url); assert.equal(r.status, 200); assert.equal(await r.text(), 'private company document');
    assert.equal((await fetch(origin + url.replace('signature=', 'signature=bad'))).status, 403);
    assert.equal(context.run({companyId:DEFAULT_COMPANY_ID,userId:'LEGACY_ADMIN'}, () => signMedia(`/uploads/${filename}`)), null);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{customers:false}}, sa);
    assert.equal((await fetch(origin + url)).status, 403);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{customers:true}}, sa);
  });
  await t.test('company module and action revocations affect already issued tokens', async () => {
    await call(`/super-admin/companies/${co.id}`, 'PUT', { modules:{ customers:false } }, sa);
    assert.equal((await call('/customers', 'GET', undefined, admin)).status, 403);
    assert.equal((await call('/auth/me', 'GET', undefined, admin)).data.permissions.customers, false);
    await call(`/super-admin/companies/${co.id}`, 'PUT', { modules:{ customers:true }, actions:{customers:{create:false}} }, sa);
    assert.equal((await call('/customers', 'GET', undefined, admin)).status, 200);
    assert.equal((await call('/customers', 'POST', { name:'Blocked', mobile:'7777777777' }, admin)).status, 403);
  });
  await t.test('bulk pay slips respect create versus edit policies and use the company name', async () => {
    const payload = { employeeName:'Sample employee', employeeNo:'PAY001', months:[{month:'2026-10',earnings:{basic:12000}}] };
    const r = await call('/payslips/bulk', 'POST', payload, admin);
    assert.equal(r.status, 200, r.message); assert.equal(r.data[0].companyName, 'Second Company');
    await call(`/super-admin/companies/${co.id}`, 'PUT', {actions:{payslips:{update:false}}}, sa);
    assert.equal((await call('/payslips/bulk', 'POST', payload, admin)).status, 403);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {actions:{payslips:{update:true,create:false}}}, sa);
    assert.equal((await call('/payslips/bulk', 'POST', payload, admin)).status, 200);
    assert.equal((await call('/payslips/bulk', 'POST', {...payload,months:[{month:'2026-11'}]}, admin)).status, 403);
  });
  await t.test('employee restrictions cannot be lifted by a company administrator', async () => {
    const owner = db.getCollection('users').find(u => u.companyId === co.id);
    const r = await call(`/super-admin/companies/${co.id}/users/${owner.id}`, 'PUT', { permissions:{customers:false} }, sa);
    assert.equal(r.status, 200, r.message);
    assert.equal((await call(`/users/${owner.id}`, 'PUT', { permissions:{customers:true}, platformPermissions:{customers:true} }, admin)).status, 200);
    assert.equal((await call('/customers', 'GET', undefined, admin)).status, 403);
    assert.equal((await call(`/super-admin/companies/${co.id}/users/LEGACY_ADMIN`, 'PUT', { name:'Hijacked' }, sa)).status, 404);
    assert.equal((await call(`/super-admin/companies/${co.id}/users/${owner.id}`, 'PUT', { isActive:false }, sa)).status, 400);
    assert.equal((await call('/users', 'POST', { name:'Escalation', mobile:'1234567890', employeeId:'ATTACK', branch:'X', role:'superAdmin', password:'anything' }, admin)).status, 403);
  });
  await t.test('company settings and collection replacement preserve other companies', async () => {
    await call('/settings/attendance-face', 'PUT', { faceAttendanceRequired:false }, admin);
    assert.equal((await call('/settings/public', 'GET', undefined, admin)).data.faceAttendanceRequired, false);
    assert.equal((await call('/settings/public', 'GET', undefined, old)).data.faceAttendanceRequired, true);
    context.run({ companyId:co.id }, () => {
      db.saveCollection('customers', []);
      assert.throws(() => db.upsert('customers', {id:'C_OLD',companyId:co.id}), /Cross-company/);
      assert.throws(() => db.saveCollection('customers', [{id:'C_OLD'}]), /Cross-company/);
      db.removeById('users', 'LEGACY_ADMIN');
    });
    assert.ok(db.findById('customers', 'C_OLD'));
    assert.ok(db.findById('users', 'LEGACY_ADMIN'));
  });
  await t.test('suspension blocks existing sessions and new logins; reactivation restores', async () => {
    await call(`/super-admin/companies/${co.id}`, 'PUT', { isActive:false }, sa);
    assert.equal((await call('/auth/me', 'GET', undefined, admin)).status, 403);
    assert.equal((await call('/auth/login', 'POST', { loginId:'owner@example.test', password:'CompanyTest432!' })).status, 403);
    await call(`/super-admin/companies/${co.id}`, 'PUT', { isActive:true }, sa);
    assert.equal((await call('/auth/me', 'GET', undefined, admin)).status, 200);
  });
  await t.test('demo OTP never authenticates Super Admin even when enabled', async () => {
    process.env.ENABLE_DEMO_OTP = 'true';
    assert.equal((await call('/auth/otp/verify', 'POST', { loginId:'ajitndfa@ndclients.co.in', otp:'123456' })).status, 404);
    delete process.env.ENABLE_DEMO_OTP;
    assert.equal((await call('/auth/otp/verify', 'POST', { loginId:'ADM001', otp:'123456' })).status, 403);
  });
  await db.flush();
  assert.ok(rows.get(`companies:${co.id}`));
  assert.ok(db.getCollection('platformAudit').length > 0);
  assert.ok(!JSON.stringify((await call('/super-admin/overview', 'GET', undefined, sa)).data).includes(firstHash));
});
