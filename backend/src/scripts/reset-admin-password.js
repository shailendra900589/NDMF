/**
 * Reset exactly one known administrator password on production DB.
 * Run on EC2 with RESET_LOGIN and RESET_PASSWORD. This never resets other users.
 * Production API keeps an in-memory cache, so RESTART_API=true restarts PM2 and
 * VERIFY_LOGIN=true proves the running API accepts the new credentials.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
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
  console.log('Password was saved to PostgreSQL for:', admin.id, admin.employeeId || admin.mobile);
  if (process.env.RESTART_API === 'true') {
    console.log('Restarting the API so it reloads the changed account…');
    execFileSync('pm2', ['restart', 'ndfa-api'], { stdio: 'inherit' });
  } else if (process.env.NODE_ENV === 'production') {
    console.log('IMPORTANT: run “pm2 restart ndfa-api” now. The running API keeps its user cache.');
  }
  if (process.env.VERIFY_LOGIN === 'true') {
    const url = process.env.VERIFY_LOGIN_URL || 'http://127.0.0.1:5000/api/v1/auth/login';
    let verified = false;
    for (let attempt = 0; attempt < 12 && !verified; attempt += 1) {
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId: RESET_LOGIN, password: NEW_PASSWORD }) });
        const result = await response.json();
        if (response.ok && result.success === true) {
          verified = true;
          console.log(`Running API login verified for ${result.data.role}.`);
          break;
        }
      } catch (_) { /* PM2 may still be starting. */ }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!verified) throw new Error('Password changed, but the running API did not verify the new login. Check: pm2 logs ndfa-api --nostream --lines 80');
  }
  console.log('Done. Sign in with the selected login ID and the new password.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
