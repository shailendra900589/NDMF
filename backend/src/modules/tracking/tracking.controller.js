const { v4: uuid } = require('uuid');
const { getCollection, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranchViaUser } = require('../../lib/rbac');

function haversineKm(p1, p2) {
  const R = 6371;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLng = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.latitude * Math.PI) / 180) *
      Math.cos((p2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Live ping — updates last position + km only (no full route history stored). */
exports.livePing = (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'lat and lng required');

  const users = getCollection('users');
  const user = users.find((u) => u.id === req.user.id);
  if (user) {
    user.liveLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      at: new Date().toISOString(),
    };
    upsert('users', user);
  }

  const today = new Date().toISOString().split('T')[0];
  const tracking = getCollection('tracking');
  let report = tracking.find(
    (t) => t.userId === req.user.id && t.date.startsWith(today)
  );

  if (!report) {
    report = {
      id: `TRK_${uuid().slice(0, 8)}`,
      userId: req.user.id,
      employeeId: req.user.employeeId,
      employeeName: req.user.name,
      branch: req.user.branch,
      date: new Date().toISOString(),
      routePoints: [],
      totalKm: 0,
      lastLat: lat,
      lastLng: lng,
    };
  }

  const point = { latitude: parseFloat(lat), longitude: parseFloat(lng), timestamp: new Date().toISOString() };
  if (report.lastLat != null && report.lastLng != null) {
    const seg = haversineKm(
      { latitude: report.lastLat, longitude: report.lastLng },
      point
    );
    if (seg > 0.01) report.totalKm = Math.round((report.totalKm + seg) * 100) / 100;
  }
  report.lastLat = point.latitude;
  report.lastLng = point.longitude;
  report.endTime = new Date().toISOString();
  report.employeeName = req.user.name;

  upsert('tracking', report);
  return success(res, {
    totalKm: report.totalKm,
    lastLat: report.lastLat,
    lastLng: report.lastLng,
  });
};

exports.getLiveTeam = (req, res) => {
  const users = getCollection('users');
  let team = users.filter((u) => u.isActive !== false && u.role !== 'admin');
  if (req.user.role === 'branchManager') {
    team = team.filter((u) => u.branch === req.user.branch);
  } else if (req.user.role === 'fieldOfficer') {
    team = team.filter((u) => u.id === req.user.id);
  }

  const today = new Date().toISOString().split('T')[0];
  const tracking = getCollection('tracking');
  const live = team
    .map((u) => {
      const loc = u.liveLocation;
      const tr = tracking.find((t) => t.userId === u.id && t.date.startsWith(today));
      return {
        userId: u.id,
        employeeId: u.employeeId,
        name: u.name,
        branch: u.branch,
        role: u.role,
        lat: loc?.lat ?? tr?.lastLat ?? null,
        lng: loc?.lng ?? tr?.lastLng ?? null,
        lastSeenAt: loc?.at ?? tr?.endTime ?? null,
        totalKmToday: tr?.totalKm ?? 0,
      };
    })
    .filter((e) => e.lat != null && e.lng != null);

  return success(res, live);
};

exports.saveRoutePoints = (req, res) => {
  const { routePoints } = req.body;
  if (!routePoints?.length) return error(res, 'Route points required');

  const today = new Date().toISOString().split('T')[0];
  const tracking = getCollection('tracking');
  let report = tracking.find(
    (t) => t.userId === req.user.id && t.date.startsWith(today)
  );

  if (!report) {
    report = {
      id: `TRK_${uuid().slice(0, 8)}`,
      userId: req.user.id,
      employeeId: req.user.employeeId,
      branch: req.user.branch,
      date: new Date().toISOString(),
      routePoints: [],
      totalKm: 0,
    };
  }

  report.routePoints.push(...routePoints);

  let totalKm = 0;
  for (let i = 1; i < report.routePoints.length; i++) {
    totalKm += haversineKm(report.routePoints[i - 1], report.routePoints[i]);
  }
  report.totalKm = Math.round(totalKm * 100) / 100;
  report.endTime = new Date().toISOString();

  upsert('tracking', report);
  return success(res, report, 'Route saved');
};

exports.getToday = (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const tracking = getCollection('tracking');
  const report = tracking.find(
    (t) => t.userId === req.user.id && t.date.startsWith(today)
  );
  return success(res, report || { totalKm: 0, routePoints: [] });
};

exports.getHistory = (req, res) => {
  const users = getCollection('users');
  let tracking = getCollection('tracking');
  if (req.user.role === 'fieldOfficer') {
    tracking = tracking.filter((t) => t.userId === req.user.id);
  } else {
    tracking = filterByBranchViaUser(tracking, req.user, users);
  }
  tracking.sort((a, b) => new Date(b.date) - new Date(a.date));
  return success(res, tracking);
};
