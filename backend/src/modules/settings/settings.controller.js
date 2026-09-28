const { success, error } = require('../../lib/response');
const { getAppSettings, setFaceAttendanceRequired } = require('../../lib/appSettings');
const { isAdmin } = require('../../lib/rbac');

exports.getPublic = (req, res) => {
  return success(res, getAppSettings());
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
