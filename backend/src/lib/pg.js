/**
 * PostgreSQL pool
 */
const { Pool } = require('pg');
const { databaseUrl } = require('../config/env');

let pool = null;

function getPool() {
  if (!pool) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for PostgreSQL');
    }
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
    pool.on('error', (err) => console.error('PG pool error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { getPool, query };
