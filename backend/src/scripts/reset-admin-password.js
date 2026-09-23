/**
 * Reset demo / admin passwords on production DB.
 * Run on EC2: cd ~/NDMF/backend && node src/scripts/reset-admin-password.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, getCollection, upsert, flush } = require('../lib/db');

const NEW_PASSWORD = process.env.RESET_PASSWORD || 'ndfa1234';
const hash = bcrypt.hashSync(NEW_PASSWORD, 10);

const ENSURE_ADMIN = {
  id: 'U_ADM001',
  name: 'Admin User',
  mobile: '9000000001',
  employeeId: 'ADM001',
  branch: null,
  role: 'admin',
  isActive: true,
};

(async () => {
  await initDb();
  const users = getCollection('users');
  let admin = users.find((u) => u.role === 'admin') || users.find((u) => u.mobile === '9000000001');

  if (!admin) {
    const { ROLE_DEFAULTS } = require('../lib/rbac');
    admin = {
      ...ENSURE_ADMIN,
      password: hash,
      permissions: ROLE_DEFAULTS.admin,
    };
    upsert('users', admin);
    console.log('Created missing admin user U_ADM001');
  } else {
    admin.password = hash;
    admin.isActive = true;
    admin.mobile = admin.mobile || ENSURE_ADMIN.mobile;
    admin.employeeId = admin.employeeId || ENSURE_ADMIN.employeeId;
    admin.role = 'admin';
    upsert('users', admin);
    console.log('Reset password for admin:', admin.id, admin.mobile, admin.employeeId);
  }

  // Optional: reset all known demo mobiles to same password
  const demoMobiles = ['9000000001', '9000000002', '9000000003', '9000000004', '9000000005'];
  for (const mobile of demoMobiles) {
    const u = users.find((x) => String(x.mobile) === mobile);
    if (u) {
      u.password = hash;
      u.isActive = true;
      upsert('users', u);
      console.log('Reset:', mobile, u.role);
    }
  }

  await flush();
  console.log('Done. Login with 9000000001 /', NEW_PASSWORD);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
