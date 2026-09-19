/**
 * JSON DATABASE
 * -------------
 * Simple file-based database - MongoDB ki jagah JSON file use ki hai
 * taaki aap manually data dekh/s edit kar saken.
 *
 * File location: backend/data/db.json
 *
 * Structure:
 * {
 *   users: [],
 *   leads: [],
 *   loans: [],
 *   customers: [],
 *   customerListings: [],
 *   attendance: [],
 *   tracking: [],
 *   callLogs: []
 * }
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/db.json');

const defaultDb = {
  users: [],
  leads: [],
  loans: [],
  customers: [],
  customerListings: [],
  attendance: [],
  tracking: [],
  callLogs: [],
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(defaultDb);
      return { ...defaultDb };
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('DB read error:', err.message);
    return { ...defaultDb };
  }
}

function writeDb(data) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getCollection(name) {
  const db = readDb();
  return db[name] || [];
}

function saveCollection(name, items) {
  const db = readDb();
  db[name] = items;
  writeDb(db);
  return items;
}

function findById(collection, id) {
  return getCollection(collection).find((item) => item.id === id) || null;
}

function upsert(collection, item) {
  const items = getCollection(collection);
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) items[index] = item;
  else items.push(item);
  saveCollection(collection, items);
  return item;
}

function removeById(collection, id) {
  const items = getCollection(collection).filter((i) => i.id !== id);
  saveCollection(collection, items);
}

module.exports = {
  readDb,
  writeDb,
  getCollection,
  saveCollection,
  findById,
  upsert,
  removeById,
  DB_PATH,
};
