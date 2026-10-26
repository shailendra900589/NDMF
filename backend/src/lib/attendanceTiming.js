const DEFAULT_TIMING = { enabled: false, opensAt: '06:00', startsAt: '09:00', closesAt: '12:00', endsAt: '18:00', graceMinutes: 15, timeZone: 'Asia/Kolkata' };
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
function validateTiming(input) {
  if (typeof input.enabled !== 'boolean') throw new Error('Enabled must be true or false');
  const policy = { ...DEFAULT_TIMING, enabled: input.enabled };
  for (const key of ['opensAt', 'startsAt', 'closesAt', 'endsAt']) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input[key] || '')) throw new Error('Enter valid 24-hour times');
    policy[key] = input[key];
  }
  policy.graceMinutes = Number(input.graceMinutes);
  if (!Number.isInteger(policy.graceMinutes) || policy.graceMinutes < 0 || policy.graceMinutes > 120) throw new Error('Grace must be 0–120 minutes');
  if (!(minutes(policy.opensAt) <= minutes(policy.startsAt) && minutes(policy.startsAt) <= minutes(policy.closesAt) && minutes(policy.closesAt) <= minutes(policy.endsAt))) throw new Error('Use a same-day shift: opening ≤ start ≤ last check-in ≤ end');
  return policy;
}
function timingAt(policy, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const current = minutes(parts);
  return { allowed: !policy.enabled || (current >= minutes(policy.opensAt) && current <= minutes(policy.closesAt)), lateMinutes: policy.enabled ? Math.max(0, current - minutes(policy.startsAt) - policy.graceMinutes) : 0, earlyDepartureMinutes: policy.enabled ? Math.max(0, minutes(policy.endsAt) - current) : 0 };
}
module.exports = { DEFAULT_TIMING, validateTiming, timingAt };
