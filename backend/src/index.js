/**
 * SERVER ENTRY POINT — PostgreSQL + Express
 */
const app = require('./app');
const { port } = require('./config/env');
const { initDb, flush } = require('./lib/db');

async function start() {
  try {
    await initDb();
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    console.error('   Set DATABASE_URL and ensure PostgreSQL is running.');
    process.exit(1);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('========================================');
    console.log('  NDFA Backend API Server');
    console.log(`  URL: http://0.0.0.0:${port}/api/v1`);
    console.log(`  Health: http://0.0.0.0:${port}/api/v1/health`);
    console.log('  DB: PostgreSQL (ndfa_docs)');
    console.log('========================================');
    console.log('');
  });

  const shutdown = async () => {
    console.log('Shutting down…');
    await flush();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
