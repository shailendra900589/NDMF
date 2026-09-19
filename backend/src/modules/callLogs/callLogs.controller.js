const { v4: uuid } = require('uuid');
const { getCollection, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { normalizeRecordingUrl } = require('../../lib/mediaUrl');
const { filterByBranchViaUser } = require('../../lib/rbac');

function enrichLog(log) {
  const users = getCollection('users');
  const user = users.find((u) => u.id === log.userId || u.employeeId === log.employeeId);
  return {
    ...log,
    recordingUrl: normalizeRecordingUrl(log.recordingUrl),
    employeeName: log.employeeName || user?.name || log.employeeId || '-',
  };
}

exports.getAll = (req, res) => {
  const users = getCollection('users');
  let logs = getCollection('callLogs');
  if (req.user.role === 'fieldOfficer') {
    logs = logs.filter((l) => l.userId === req.user.id);
  } else {
    logs = filterByBranchViaUser(logs, req.user, users);
  }
  logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  return success(res, logs.map(enrichLog));
};

exports.create = (req, res) => {
  const {
    customerName,
    mobile,
    duration,
    durationSeconds,
    recordingDurationSeconds,
    callStatus,
    callSummary,
    telephonyVerified,
    type,
    leadId,
    recordingUrl,
    employeeName,
    time,
    date,
  } = req.body;
  if (!mobile) return error(res, 'Mobile required');

  const log = {
    id: req.body.id || `CALL_${uuid().slice(0, 8)}`,
    userId: req.user.id,
    branch: req.user.branch,
    employeeId: req.user.employeeId,
    employeeName: employeeName || req.user.name,
    customerName: customerName || '',
    mobile,
    date: date || new Date().toISOString(),
    time:
      time ||
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    duration: duration || '0:00',
    durationSeconds:
      typeof durationSeconds === 'number'
        ? durationSeconds
        : parseInt(String(durationSeconds || '0'), 10) || 0,
    recordingDurationSeconds:
      typeof recordingDurationSeconds === 'number'
        ? recordingDurationSeconds
        : parseInt(String(recordingDurationSeconds || '0'), 10) || 0,
    callStatus: callStatus || 'unknown',
    callSummary: callSummary || '',
    telephonyVerified: telephonyVerified === true,
    type: type || 'outgoing',
    leadId: leadId || null,
    recordingUrl: normalizeRecordingUrl(recordingUrl),
  };
  upsert('callLogs', log);
  return success(res, enrichLog(log), 'Call logged', 201);
};

exports.update = (req, res) => {
  const logs = getCollection('callLogs');
  const idx = logs.findIndex((l) => l.id === req.params.id);
  if (idx < 0) return error(res, 'Call log not found', 404);
  const existing = logs[idx];
  if (req.user.role === 'fieldOfficer' && existing.userId !== req.user.id) {
    return error(res, 'Forbidden', 403);
  }
  const patch = {
    callSummary: req.body.callSummary ?? existing.callSummary,
    recordingUrl: normalizeRecordingUrl(req.body.recordingUrl ?? existing.recordingUrl),
    duration: req.body.duration ?? existing.duration,
    durationSeconds: req.body.durationSeconds ?? existing.durationSeconds,
    callStatus: req.body.callStatus ?? existing.callStatus,
  };
  const updated = { ...existing, ...patch };
  upsert('callLogs', updated);
  return success(res, enrichLog(updated), 'Call log updated');
};
