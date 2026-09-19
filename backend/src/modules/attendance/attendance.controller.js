const { v4: uuid } = require('uuid');
const { getCollection, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranchViaUser } = require('../../lib/rbac');

const BRANCH_LAT = 28.6139;
const BRANCH_LNG = 77.209;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.checkIn = (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');

  const today = new Date().toISOString().split('T')[0];
  const attendance = getCollection('attendance');
  const existing = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );

  if (existing && existing.checkInTime) {
    return error(res, 'Already checked in today');
  }

  const record = existing || {
    id: `ATT_${uuid().slice(0, 8)}`,
    userId: req.user.id,
    employeeId: req.user.employeeId,
    branch: req.user.branch,
    date: new Date().toISOString(),
    status: 'Present',
  };

  record.checkInTime = new Date().toISOString();
  record.checkInLat = lat;
  record.checkInLng = lng;
  record.distanceFromBranch = Math.round(distanceMeters(lat, lng, BRANCH_LAT, BRANCH_LNG));

  upsert('attendance', record);
  return success(res, record, 'Checked in successfully');
};

exports.checkOut = (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');

  const today = new Date().toISOString().split('T')[0];
  const attendance = getCollection('attendance');
  const record = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );

  if (!record || !record.checkInTime) {
    return error(res, 'Check in first');
  }
  if (record.checkOutTime) {
    return error(res, 'Already checked out today');
  }

  record.checkOutTime = new Date().toISOString();
  record.checkOutLat = lat;
  record.checkOutLng = lng;

  upsert('attendance', record);
  return success(res, record, 'Checked out successfully');
};

exports.getHistory = (req, res) => {
  const users = getCollection('users');
  let history = getCollection('attendance');
  if (req.user.role === 'fieldOfficer') {
    history = history.filter((a) => a.userId === req.user.id);
  } else {
    history = filterByBranchViaUser(history, req.user, users);
  }
  history.sort((a, b) => new Date(b.date) - new Date(a.date));
  return success(res, history);
};
