/**
 * Reset exactly one known administrator password on production DB.
 * Run on EC2 with RESET_LOGIN and RESET_PASSWORD. This never resets other users.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDb, getCollection, upsert, flush } = require('../lib/db');

const RESET_LOGIN = String(process.env.RESET_LOGIN || '').trim();
const NEW_PASSWORD = process.env.RESET_PASSWORD || '';
if (!RESET_LOGIN || NEW_PASSWORD.length < 8) {
  console.error('Set RESET_LOGIN and a RESET_PASSWORD of at least 8 characters. No account was changed.');
  process.exit(2);
}
const hash = bcrypt.hashSync(NEW_PASSWORD, 10);

(async () => {
  await initDb();
  const users = getCollection('users');
  const lookup = RESET_LOGIN.toLowerCase();
  const admin = users.find((u) => String(u.mobile || '') === RESET_LOGIN || String(u.employeeId || '').toLowerCase() === lookup || String(u.email || '').toLowerCase() === lookup);
  if (!admin || admin.role !== 'admin') throw new Error('Active company administrator for RESET_LOGIN was not found. No account was changed.');
  admin.password = hash;
  admin.isActive = true;
  upsert('users', admin);
  console.log('Password reset for:', admin.id, admin.employeeId || admin.mobile);

  await flush();
  console.log('Done. Sign in with the selected login ID and the new password.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
