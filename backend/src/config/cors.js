/**
 * CORS allowlist — production domains + Flutter Web on localhost (any port).
 */
const { corsOrigins } = require('./env');

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  } catch (_) {
    return false;
  }
  return false;
}

module.exports = { isCorsOriginAllowed };
