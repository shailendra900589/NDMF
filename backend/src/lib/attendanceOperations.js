const { getCollection } = require('./db');
const { getAppSettings } = require('./appSettings');
const { validateTiming } = require('./attendanceTiming');

const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
const validScope = scope => ['default', 'branch', 'employee'].includes(scope);

function validateSchedule(input = {}) {
  if (!validScope(input.scope)) throw new Error('Choose default, branch or employee timing');
  if (input.scope === 'branch' && !String(input.branch || '').trim()) throw new Error('Choose a branch');
  if (input.scope === 'employee' && !String(input.userId || '').trim()) throw new Error('Choose an employee');
  const weekdays = Array.isArray(input.weekdays) ? [...new Set(input.weekdays.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))] : [0,1,2,3,4,5,6];
  if (!weekdays.length) throw new Error('Select at least one working day');
  return { scope: input.scope, branch: input.scope === 'branch' ? String(input.branch).trim() : null,
    userId: input.scope === 'employee' ? String(input.userId).trim() : null,
    name: String(input.name || '').trim().slice(0, 80) || 'Standard shift', weekdays, policy: validateTiming(input.policy || input) };
}

function resolveSchedule(user, date = new Date()) {
  const day = new Date(`${dateKey(date)}T12:00:00`).getDay();
  const rows = getCollection('attendanceSchedules').filter(s => (s.weekdays || [0,1,2,3,4,5,6]).includes(day));
  const chosen = rows.find(s => s.scope === 'employee' && s.userId === user.id) ||
    rows.find(s => s.scope === 'branch' && s.branch === user.branch) || null;
  return chosen || { id: 'default', scope: 'default', name: 'Default shift', weekdays: [0,1,2,3,4,5,6], policy: getAppSettings().attendanceTiming };
}

function resolveFestival(user, date = new Date()) {
  const key = typeof date === 'string' ? date : dateKey(date);
  const rows = getCollection('attendanceFestivals').filter(f => f.date === key);
  return rows.find(f => f.scope === 'employee' && f.userId === user.id) ||
    rows.find(f => f.scope === 'branch' && f.branch === user.branch) ||
    rows.find(f => f.scope === 'company') || null;
}

function validateFestival(input = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(Date.parse(`${input.date}T12:00:00Z`))) throw new Error('Choose a valid festival date');
  if (!['company','branch','employee'].includes(input.scope)) throw new Error('Choose festival audience');
  if (input.scope === 'branch' && !String(input.branch || '').trim()) throw new Error('Choose a branch');
  if (input.scope === 'employee' && !String(input.userId || '').trim()) throw new Error('Choose an employee');
  if (!['paid_leave','unpaid_leave','working_day'].includes(input.leaveType)) throw new Error('Choose leave treatment');
  const name = String(input.name || '').trim(); if (name.length < 2 || name.length > 120) throw new Error('Festival name must be 2–120 characters');
  return { name, date: input.date, scope: input.scope, branch: input.scope === 'branch' ? String(input.branch).trim() : null,
    userId: input.scope === 'employee' ? String(input.userId).trim() : null, leaveType: input.leaveType, description: String(input.description || '').trim().slice(0, 500) };
}
module.exports = { dateKey, validateSchedule, resolveSchedule, resolveFestival, validateFestival };
