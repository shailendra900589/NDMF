const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
}, WINDOW_MS);
cleanup.unref();
module.exports = function loginThrottle(req, res, next) {
  const key = `${req.ip}:${String(req.body?.loginId || req.body?.mobile || req.body?.employeeId || '').trim().toLowerCase()}`;
  const existing = attempts.get(key);
  const item = existing?.until > Date.now() ? existing : { count: 0, until: Date.now() + WINDOW_MS };
  if (item.count >= 15) {
    res.setHeader('Retry-After', String(Math.ceil((item.until - Date.now()) / 1000)));
    return res.status(429).json({ success: false, message: 'Too many sign-in attempts. Please try again later.', data: null });
  }
  if (attempts.size > 10000) attempts.delete(attempts.keys().next().value);
  item.count += 1; attempts.set(key, item);
  res.on('finish', () => { if (res.statusCode < 400) attempts.delete(key); });
  next();
};
