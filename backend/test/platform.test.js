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
  t.after(() => { rows.clear(); assert.equal(rows.size, 0, 'temporary test data is cleared'); });
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
  await t.test('new company onboarding and every role panel enforce branch and company boundaries', async () => {
    const north = await call('/branches', 'POST', { name:'North office' }, admin);
    const south = await call('/branches', 'POST', { name:'South office' }, admin);
    assert.equal(north.status, 201, north.message); assert.equal(south.status, 201, south.message);
    const createStaff = async (employeeId, role, branch, actor = admin) => {
      const r = await call('/users', 'POST', { name:employeeId, mobile:employeeId === 'MANAGER_N' ? '8100000001' : employeeId === 'STAFF_N' ? '8100000002' : '8100000003', employeeId, role, branch, password:'StaffTest432!' }, actor);
      assert.equal(r.status, 201, r.message); return { user:r.data, token:await login(employeeId, 'StaffTest432!') };
    };
    const manager = await createStaff('MANAGER_N', 'branchManager', 'North office');
    const employee = await createStaff('STAFF_N', 'fieldOfficer', 'North office', manager.token);
    const other = await createStaff('STAFF_S', 'fieldOfficer', 'South office');
    assert.equal((await call('/users', 'POST', { name:'Invalid branch', mobile:'8100000004', employeeId:'INVALID_BRANCH', role:'fieldOfficer', branch:'Missing', password:'StaffTest432!' }, admin)).status, 400);
    assert.equal((await call(`/users/${employee.user.id}`, 'PUT', { name:'Must not persist', branch:'Missing' }, admin)).status, 400);
    assert.equal(db.findById('users', employee.user.id).name, 'STAFF_N', 'failed updates must not mutate cached users');
    assert.equal((await call(`/users/${employee.user.id}`, 'PUT', {name:'Must not persist either',password:'x'}, admin)).status, 400);
    assert.equal(db.findById('users', employee.user.id).name, 'STAFF_N');

    assert.equal((await call(`/users/${other.user.id}`, 'PUT', { name:'Cross branch' }, manager.token)).status, 403);
    assert.equal((await call('/branches', 'POST', { name:'Forbidden' }, manager.token)).status, 403);
    assert.equal((await call('/users', 'GET', undefined, employee.token)).status, 403);
    assert.equal((await call('/payslips', 'GET', undefined, manager.token)).status, 403);
    const visible = (await call('/users', 'GET', undefined, manager.token)).data;
    assert.deepEqual(visible.map(u => u.id), [employee.user.id]);
    for (const token of [admin, manager.token, employee.token]) {
      for (const path of ['/auth/me','/dashboard/stats','/customer-listings','/customers','/attendance/history','/attendance/monthly','/tracking/live','/tracking/today','/tracking/history','/tracking/people','/call-logs','/branches']) {
        const r = await call(path, 'GET', undefined, token);
        assert.equal(r.status, 200, `${path}: ${r.message}`);
      }
      assert.equal((await call('/super-admin/overview', 'GET', undefined, token)).status, 403);
    }
    for (const path of ['/users','/users/permission-schema','/payslips']) assert.equal((await call(path, 'GET', undefined, admin)).status, 200, path);
    assert.equal((await call('/dashboard/stats', 'GET', undefined, admin)).data.scope, 'all_branches');
    assert.equal((await call('/dashboard/stats', 'GET', undefined, manager.token)).data.scope, 'branch');
    const fs = require('node:fs'), path = require('node:path');
    const photoName = `${co.id}_${require('node:crypto').randomUUID()}.png`;
    const photoPath = path.join(__dirname, '../uploads', photoName);
    fs.writeFileSync(photoPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ0AAAAASUVORK5CYII=', 'base64'));
    t.after(() => fs.unlinkSync(photoPath));
    const enrolled = db.findById('users', employee.user.id);
    db.upsert('users', {...enrolled,faceEnrollmentUrls:Array(3).fill(`/uploads/${photoName}`),faceEnrollmentAt:new Date().toISOString(),faceDescriptors:[[1,2,3]],faceVerification:{secret:'never expose'}}, {single:true});
    for (const actor of [admin, manager.token, employee.token]) {
      const photos = await call(`/attendance/enrollment/${employee.user.id}`, 'GET', undefined, actor);
      assert.equal(photos.status, 200); assert.equal(photos.data.photos.length, 3); assert.equal(photos.data.complete, true);
      assert.ok(photos.data.photos[0].includes('signature='));
      assert.ok(!JSON.stringify(photos.data).includes('faceDescriptors'));
      assert.ok(!JSON.stringify(photos.data).includes('never expose'));
      const image = await fetch(base.replace('/api/v1','') + photos.data.photos[0]);
      assert.equal(image.status, 200);
    }
    assert.equal((await call(`/attendance/enrollment/${employee.user.id}`, 'GET', undefined, other.token)).status, 403);
    assert.equal((await call(`/attendance/enrollment/${other.user.id}`, 'GET', undefined, manager.token)).status, 403);
    assert.equal((await call(`/attendance/enrollment/${employee.user.id}`, 'GET', undefined, old)).status, 404);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{attendance:false}}, sa);
    assert.equal((await call(`/attendance/enrollment/${employee.user.id}`, 'GET', undefined, admin)).status, 403);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{attendance:true}}, sa);
    const log = await call('/call-logs', 'POST', { mobile:'8000000000', callSummary:'South private call' }, other.token);
    assert.equal(log.status, 201);
    assert.equal((await call(`/call-logs/${log.data.id}`, 'PUT', {callSummary:'Hijacked'}, manager.token)).status, 403);
    assert.equal((await call(`/call-logs/${log.data.id}`, 'PUT', {callSummary:'Own update'}, other.token)).status, 200);
    assert.equal((await call('/call-logs', 'GET', undefined, manager.token)).data.length, 0);
    assert.equal((await call('/call-logs', 'GET', undefined, old)).data.length, 0);
    assert.equal((await call('/call-logs', 'POST', {mobile:'8000000001'}, employee.token)).status, 201);
    assert.equal((await call('/call-logs', 'POST', {mobile:'8000000002'}, manager.token)).status, 201);
    assert.equal((await call('/dashboard/stats', 'GET', undefined, employee.token)).data.totalCallsToday, 1, 'employee dashboard counts only own calls');
    assert.equal((await call('/dashboard/stats', 'GET', undefined, manager.token)).data.totalCallsToday, 2, 'manager dashboard covers own branch');
    assert.equal((await call('/dashboard/stats', 'GET', undefined, admin)).data.totalCallsToday, 3, 'admin dashboard covers the company');

    const listingBody = { name:'North applicant', mobile:'8200000000', branch:'North office', shopFullAddress:'Test office', shopLatitude:28.61, shopLongitude:77.20,
      neighbors:[{shopName:'One',remarks:'Verified'},{shopName:'Two',remarks:'Verified'}],
      ...Object.fromEntries(['customerPhoto','aadhaarFront','aadhaarBack','panFront','shopPhoto1','shopPhoto2','shopPhoto3','shopPhoto4'].map(k => [k,'https://example.test/photo.jpg'])) };
    assert.equal((await call('/customer-listings', 'POST', {...listingBody,branch:'South office'}, employee.token)).status, 403);
    const listing = await call('/customer-listings', 'POST', listingBody, employee.token);
    assert.equal(listing.status, 201, listing.message); assert.equal(listing.data.status, 'branchPending');
    assert.equal((await call(`/customer-listings/${listing.data.id}`, 'GET', undefined, other.token)).status, 403);
    assert.equal((await call('/customer-listings', 'POST', {...listingBody,id:listing.data.id}, other.token)).status, 409);
    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'approve'}, employee.token)).status, 403);
    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'approve'}, manager.token)).data.status, 'adminPending');
    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'reject'}, manager.token)).status, 403);
    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'rework'}, admin)).data.status, 'draft');
    assert.equal((await call('/customer-listings', 'POST', {...listingBody,id:listing.data.id}, employee.token)).data.status, 'branchPending');
    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'approve'}, manager.token)).data.status, 'adminPending');

    assert.equal((await call('/customer-listings/approve', 'POST', {id:listing.data.id,action:'finalApprove'}, admin)).data.status, 'listed');
    const retry = await call('/customer-listings', 'POST', {...listingBody,id:listing.data.id}, employee.token);
    assert.equal(retry.status, 200); assert.equal(retry.data.status, 'listed', 'offline retries preserve final approval');
    assert.equal((await call('/customers', 'GET', undefined, employee.token)).data.length, 1);
    assert.equal((await call('/customers', 'GET', undefined, other.token)).data.length, 0);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{tracking:false}}, sa);
    assert.equal((await call('/auth/me', 'GET', undefined, admin)).data.permissions.tracking, false);
    assert.equal((await call('/tracking/live', 'GET', undefined, admin)).status, 403);
    await call(`/super-admin/companies/${co.id}`, 'PUT', {modules:{tracking:true}}, sa);
    const disabled = await call(`/super-admin/companies/${co.id}/users`, 'POST', {name:'Disabled staff',employeeId:'DISABLED_STAFF',role:'fieldOfficer',branch:'North office',password:'StaffTest432!',isActive:false}, sa);
    assert.equal(disabled.status, 201, disabled.message); assert.equal(disabled.data.isActive, false);
    assert.equal((await call('/auth/login', 'POST', {loginId:'DISABLED_STAFF',password:'StaffTest432!'})).status, 403);
    const owner = db.getCollection('users').find(u => u.companyId === co.id && u.role === 'admin');
    assert.equal((await call(`/super-admin/companies/${co.id}/users/${owner.id}`, 'PUT', {role:'fieldOfficer'}, sa)).status, 400);
    await call(`/super-admin/companies/${co.id}/users/${employee.user.id}`, 'PUT', {isActive:false}, sa);
    assert.equal((await call('/auth/me', 'GET', undefined, employee.token)).status, 403);
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
