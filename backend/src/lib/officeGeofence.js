/**
 * OFFICE GEOFENCE — office staff may check in only near their office.
 * Field staff are never restricted.
 */
const { getCollection } = require('./db');
const { haversineMeters } = require('./gpsTrack');

const DEFAULT_RADIUS_M = 100;
const MIN_RADIUS_M = 20;
const MAX_RADIUS_M = 5000;
/** Phone GPS is rarely better than this indoors, so allow a small margin. */
const DEFAULT_GPS_MARGIN_M = 15;
const MAX_GPS_MARGIN_M = 30;

function workTypeOf(user) {
  return user?.workType === 'office' ? 'office' : 'field';
}

function cleanRadius(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return undefined;
  if (n < MIN_RADIUS_M || n > MAX_RADIUS_M) return undefined;
  return n;
}

function cleanCoord(value, limit) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) return undefined;
  return Math.round(n * 1e7) / 1e7;
}

function branchOf(user) {
  const name = String(user?.branch || '').trim().toLowerCase();
  if (!name) return null;
  return getCollection('branches').find((b) => String(b.name || '').trim().toLowerCase() === name) || null;
}

function hasOfficeLocation(branch) {
  return Number.isFinite(Number(branch?.officeLat)) && Number.isFinite(Number(branch?.officeLng)) &&
    branch.officeLat !== null && branch.officeLng !== null;
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

/** Straight-line distance from the employee's branch office, or null when not set. */
function distanceToOffice(user, lat, lng) {
  const branch = branchOf(user);
  if (!hasOfficeLocation(branch)) return null;
  return Math.round(
    haversineMeters({ lat: Number(lat), lng: Number(lng) }, { lat: Number(branch.officeLat), lng: Number(branch.officeLng) })
  );
}

/**
 * Decides whether this check-in position is allowed.
 * Returns { allowed, workType, distanceMeters, radiusMeters, officeName, message }.
 */
function checkAttendancePosition(user, lat, lng, accuracy) {
  const workType = workTypeOf(user);
  const branch = branchOf(user);
  const distance = distanceToOffice(user, lat, lng);
  if (workType === 'field') {
    return { allowed: true, workType, distanceMeters: distance, radiusMeters: null, officeName: branch?.name || null };
  }

  if (!hasOfficeLocation(branch)) {
    return {
      allowed: false,
      workType,
      distanceMeters: null,
      radiusMeters: null,
      officeName: branch?.name || user.branch || null,
      message: `Office location for ${branch?.name || user.branch || 'your branch'} is not set yet. Ask admin to set it under Locations.`,
    };
  }

  const radius = cleanRadius(user.attendanceRadiusM) || cleanRadius(branch.attendanceRadiusM) || DEFAULT_RADIUS_M;
  const acc = Number(accuracy);
  const margin = Number.isFinite(acc) && acc >= 0 ? Math.min(acc, MAX_GPS_MARGIN_M) : DEFAULT_GPS_MARGIN_M;
  const allowed = distance <= radius + margin;
  return {
    allowed,
    workType,
    distanceMeters: distance,
    radiusMeters: radius,
    officeName: branch.name,
    message: allowed
      ? null
      : `You are ${formatDistance(distance)} away from the ${branch.name} office. Attendance is allowed only within ${formatDistance(radius)} of the office.`,
  };
}

module.exports = {
  DEFAULT_RADIUS_M,
  MIN_RADIUS_M,
  MAX_RADIUS_M,
  workTypeOf,
  cleanRadius,
  cleanCoord,
  hasOfficeLocation,
  distanceToOffice,
  checkAttendancePosition,
};
