const DEFAULT_TIMING = { enabled: false, opensAt: '06:00', startsAt: '09:00', closesAt: '12:00', endsAt: '18:00', graceMinutes: 15, halfDayAfterMinutes:60, timeZone: 'Asia/Kolkata' };
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
  policy.halfDayAfterMinutes=Number(input.halfDayAfterMinutes??60);
  if(!Number.isInteger(policy.halfDayAfterMinutes)||policy.halfDayAfterMinutes<=policy.graceMinutes||policy.halfDayAfterMinutes>480)throw new Error('Half-day cutoff must be after grace and within 480 minutes of shift start');
  if (!(minutes(policy.opensAt) <= minutes(policy.startsAt) && minutes(policy.startsAt) <= minutes(policy.closesAt) && minutes(policy.closesAt) <= minutes(policy.endsAt))) throw new Error('Use a same-day shift: opening ≤ start ≤ last check-in ≤ end');
  return policy;
}
function timingAt(policy, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const current = minutes(parts);
  const start=minutes(policy.startsAt),opening=Math.max(0,Math.min(minutes(policy.opensAt),start-30));
  const precise=current+now.getUTCSeconds()/60,halfDayAt=start+(policy.halfDayAfterMinutes??60),lateMinutes=Math.max(0,Math.ceil(precise-start-policy.graceMinutes));
  return { allowed: !policy.enabled || (current >= opening && current <= minutes(policy.closesAt)), opensAt:`${String(Math.floor(opening/60)).padStart(2,'0')}:${String(opening%60).padStart(2,'0')}`, attendanceStatus:current>=halfDayAt?'half_day':lateMinutes>0?'late':'present',lateMinutes, earlyDepartureMinutes: policy.enabled ? Math.max(0, minutes(policy.endsAt) - current) : 0 };
}
function arrivalStatus(record){return record.attendanceStatus || (record.attendanceTiming && record.checkInTime?timingAt(record.attendanceTiming,new Date(record.checkInTime)).attendanceStatus:'present');}
module.exports = { DEFAULT_TIMING, validateTiming, timingAt, arrivalStatus };
