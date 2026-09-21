/**
 * SERVER ENTRY POINT
 * ------------------
 * Ye file server start karti hai.
 * Run: npm run dev   OR   npm start
 */
const app = require('./app');
const { port } = require('./config/env');
const { readDb, DB_PATH } = require('./lib/db');
const fs = require('fs');

// Pehli baar db.json check karo
readDb();
console.log(`📁 Database file: ${DB_PATH}`);

// Seed check
const db = readDb();
if (!db.users?.length) {
  console.log('⚠️  No users found. Run: npm run seed');
}

app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log('========================================');
  console.log('  NDFA Backend API Server');
  console.log(`  URL: http://0.0.0.0:${port}/api/v1`);
  console.log(`  Health: http://0.0.0.0:${port}/api/v1/health`);
  console.log('========================================');
  console.log('');
});
