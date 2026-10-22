/**
 * DATABASE LAYER — PostgreSQL (JSONB docs) + in-memory cache
 * Controllers keep using sync getCollection / findById / upsert.
 * Writes update memory immediately, then persist to Postgres.
 *
 * Table: ndfa_docs (collection, id, data JSONB)
 */
const fs = require('fs');
const path = require('path');
const { query, getPool } = require('./pg');

const JSON_FALLBACK_PATH = path.join(__dirname, '../../data/db.json');

const COLLECTIONS = [
  'branches',
  'users',
  'customers',
  'customerListings',
  'attendance',
  'tracking',
  'liveLocations',
  'callLogs',
  'leads',
  'loans',
  'collections',
  'digilockerSessions',
  'payslips',
  'appSettings',
];

const defaultDb = () => ({
  branches: [],
  users: [],
  customers: [],
  customerListings: [],
  attendance: [],
  tracking: [],
  liveLocations: [],
  callLogs: [],
  leads: [],
  loans: [],
  collections: [],
  digilockerSessions: [],
  payslips: [],
  appSettings: [],
});

/** @type {Record<string, any[]>} */
let cache = defaultDb();
let ready = false;
let writeChain = Promise.resolve();

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS ndfa_docs (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_ndfa_docs_collection ON ndfa_docs (collection);
  `);
}

async function loadCacheFromPg() {
  const res = await query('SELECT collection, id, data FROM ndfa_docs');
  const next = defaultDb();
  for (const row of res.rows) {
    if (!next[row.collection]) next[row.collection] = [];
    next[row.collection].push(row.data);
  }
  cache = next;
}

async function persistCollection(name) {
  const items = cache[name] || [];
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ndfa_docs WHERE collection = $1', [name]);
    for (const item of items) {
      if (!item?.id) continue;
      await client.query(
        `INSERT INTO ndfa_docs (collection, id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (collection, id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [name, String(item.id), JSON.stringify(item)]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function queueTask(label, task) {
  writeChain = writeChain
    .then(task)
    .catch((err) => console.error(`PG persist [${label}] failed:`, err.message));
  return writeChain;
}

function queuePersist(name) {
  return queueTask(name, () => persistCollection(name));
}

async function persistItem(name, id) {
  const item = (cache[name] || []).find((i) => i.id === id);
  if (!item) return;
  await query(
    `INSERT INTO ndfa_docs (collection, id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (collection, id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [name, String(id), JSON.stringify(item)]
  );
}

/** Pending delayed writes, keyed by "collection:id". */
const deferredWrites = new Map();

function cancelDeferred(key) {
  const timer = deferredWrites.get(key);
  if (timer) {
    clearTimeout(timer);
    deferredWrites.delete(key);
  }
}

function queuePersistItem(name, id, deferMs = 0) {
  const key = `${name}:${id}`;
  if (deferMs > 0) {
    if (deferredWrites.has(key)) return writeChain;
    const timer = setTimeout(() => {
      deferredWrites.delete(key);
      queueTask(name, () => persistItem(name, id));
    }, deferMs);
    if (timer.unref) timer.unref();
    deferredWrites.set(key, timer);
    return writeChain;
  }
  cancelDeferred(key);
  return queueTask(name, () => persistItem(name, id));
}

async function persistAll() {
  for (const name of COLLECTIONS) {
    await persistCollection(name);
  }
}

async function initDb() {
  await ensureSchema();
  await loadCacheFromPg();

  const userCount = (cache.users || []).length;
  if (userCount === 0 && fs.existsSync(JSON_FALLBACK_PATH)) {
    console.log('📥 Migrating existing db.json → PostgreSQL…');
    const raw = JSON.parse(fs.readFileSync(JSON_FALLBACK_PATH, 'utf8'));
    cache = { ...defaultDb(), ...raw };
    await persistAll();
    console.log('✅ Migration from db.json complete');
  }

  ready = true;
  console.log(
    `🐘 PostgreSQL ready — users=${(cache.users || []).length}, branches=${(cache.branches || []).length}`
  );
  return cache;
}

function assertReady() {
  if (!ready) {
    throw new Error('Database not initialized. Wait for initDb().');
  }
}

function readDb() {
  assertReady();
  return JSON.parse(JSON.stringify(cache));
}

function writeDb(data) {
  assertReady();
  cache = { ...defaultDb(), ...data };
  for (const name of Object.keys(cache)) {
    if (!Array.isArray(cache[name])) cache[name] = [];
  }
  writeChain = writeChain.then(() => persistAll()).catch((e) => console.error(e.message));
  return cache;
}

function getCollection(name) {
  assertReady();
  if (!cache[name]) cache[name] = [];
  return cache[name];
}

function saveCollection(name, items) {
  assertReady();
  cache[name] = items;
  queuePersist(name);
  return items;
}

function findById(collection, id) {
  return getCollection(collection).find((item) => item.id === id) || null;
}

/**
 * Saves a document. By default the whole collection is written (old behaviour).
 * `single` writes only this document; `deferMs` also batches frequent updates
 * (GPS every 15s) into one write per window. Memory is always up to date.
 */
function upsert(collection, item, { single = false, deferMs = 0 } = {}) {
  const items = getCollection(collection);
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  cache[collection] = items;
  if ((single || deferMs > 0) && item?.id) queuePersistItem(collection, item.id, deferMs);
  else queuePersist(collection);
  return item;
}

function removeById(collection, id) {
  const items = getCollection(collection).filter((i) => i.id !== id);
  cache[collection] = items;
  cancelDeferred(`${collection}:${id}`);
  queuePersist(collection);
}

function flush() {
  for (const [key, timer] of deferredWrites) {
    clearTimeout(timer);
    const sep = key.indexOf(':');
    const name = key.slice(0, sep);
    const id = key.slice(sep + 1);
    queueTask(name, () => persistItem(name, id));
  }
  deferredWrites.clear();
  return writeChain;
}

module.exports = {
  initDb,
  readDb,
  writeDb,
  getCollection,
  saveCollection,
  findById,
  upsert,
  removeById,
  flush,
  persistAll,
  DB_PATH: 'postgresql:ndfa_docs',
  COLLECTIONS,
};
