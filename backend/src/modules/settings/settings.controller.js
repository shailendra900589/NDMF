const { success, error } = require('../../lib/response');
const { getAppSettings, setFaceAttendanceRequired } = require('../../lib/appSettings');
const { isAdmin } = require('../../lib/rbac');

exports.getPublic = (req, res) => {
  return success(res, getAppSettings());
};

exports.updateTiming = async (req, res) => {
  if (!isAdmin(req.user)) return error(res, 'Only admin can change attendance timings', 403);
  let policy;
  try { policy = require('../../lib/attendanceTiming').validateTiming(req.body); } catch (e) { return error(res, e.message); }
  const next = require('../../lib/appSettings').setAttendanceTiming(policy);
  const { upsert, flush } = require('../../lib/db');
  upsert('platformAudit', { id: require('crypto').randomUUID(), companyId: req.user.companyId, actorId: req.user.id, action: 'attendance.timing.updated', policy, createdAt: new Date().toISOString() });
  await flush();
  return success(res, next, 'Attendance timings saved (IST)');
};

exports.updateFaceAttendance = (req, res) => {
  if (!isAdmin(req.user)) {
    return error(res, 'Only admin can change face attendance policy', 403);
  }
  const enabled = req.body.faceAttendanceRequired ?? req.body.enabled;
  if (typeof enabled !== 'boolean') {
    return error(res, 'faceAttendanceRequired (boolean) is required');
  }
  const next = setFaceAttendanceRequired(enabled);
  return success(
    res,
    next,
    enabled ? 'Face verification enabled for attendance' : 'Face verification disabled for attendance'
  );
};
