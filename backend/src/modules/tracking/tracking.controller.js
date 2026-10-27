const { v4: uuid } = require('uuid');
const { getCollection, saveCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { isAdmin, hasPermission, sameBranch } = require('../../lib/rbac');
const { normalizePoint, ingest, reportPoints, compactReport } = require('../../lib/gpsTrack');
const { analyzeShift } = require('../../lib/routeAnalysis');
const { workTypeOf } = require('../../lib/officeGeofence');
const { attendanceDay } = require('../../lib/attendanceDay');

/** Route history is kept for this many days. */
const RETENTION_DAYS = Math.max(1, parseInt(process.env.TRACKING_RETENTION_DAYS || '90', 10));

/** Live position counts as "live" when the last fix is this fresh. */
const LIVE_WINDOW_MS = 45 * 1000;
const DELAYED_WINDOW_MS = 5 * 60 * 1000;
/** Heavy day reports are written to the database at most this often. */
const REPORT_WRITE_DELAY_MS = 30 * 1000;
const LIVE_WRITE_DELAY_MS = 15 * 1000;
const DUTY_GRACE_MS = 2 * 60 * 1000;
/** A check-in left open longer than this is treated as forgotten, not on duty. */
const MAX_SHIFT_MS = 20 * 60 * 60 * 1000;
const MAX_BATCH = 3000;

function dayKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function withinDuty(att, at) {
  if (!att?.checkInTime) return false;
  const start = Date.parse(att.checkInTime) - DUTY_GRACE_MS;
  const end = att.checkOutTime
    ? Date.parse(att.checkOutTime) + DUTY_GRACE_MS
    : Date.parse(att.checkInTime) + MAX_SHIFT_MS;
  return at >= start && at <= end;
}

function attendancesOf(userId) {
  return getCollection('attendance')
    .filter((a) => a.userId === userId && a.checkInTime)
    .sort((a, b) => Date.parse(b.checkInTime) - Date.parse(a.checkInTime));
}

/** The shift a fix belongs to, so a duty that crosses midnight stays one route. */
function shiftAt(userId, at) {
  return attendancesOf(userId).find((a) => withinDuty(a, at)) || null;
}

/** The shift to show on the live map: still open, or checked in today. */
function currentShift(userId, now) {
  const latest = attendancesOf(userId)[0];
  if (!latest) return null;
  if (!latest.checkOutTime && withinDuty(latest, now)) return latest;
  return String(latest.date).startsWith(dayKey(now)) ? latest : null;
}

function reportFor(user, att, create) {
  if (!att) return null;
  const tracking = getCollection('tracking');
  const key = dayKey(att.checkInTime);
  let report =
    tracking.find((t) => t.attendanceId === att.id) ||
    tracking.find((t) => t.userId === user.id && !t.attendanceId && String(t.date).startsWith(key));
  if (!report && create) {
    report = {
      id: `TRK_${uuid().slice(0, 8)}`,
      userId: user.id,
      attendanceId: att.id,
      employeeId: user.employeeId,
      employeeName: user.name,
      branch: user.branch,
      date: att.checkInTime,
      startTime: att.checkInTime,
      routePoints: [],
      totalKm: 0,
      totalMeters: 0,
    };
  }
  return report;
}

function saveLive(user, point) {
  const live = findById('liveLocations', user.id) || { id: user.id, userId: user.id };
  if (live.at && point.at <= Date.parse(live.at)) return live;
  Object.assign(live, {
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy,
    speed: point.speed,
    heading: point.heading,
    mocked: point.mocked,
    at: new Date(point.at).toISOString(),
    receivedAt: new Date().toISOString(),
    attendanceId: point.attendanceId || null,
  });
  upsert('liveLocations', live, { deferMs: LIVE_WRITE_DELAY_MS });
  return live;
}

/** Adds fixes for the signed-in employee. Only fixes taken during a check-in are kept. */
function recordFixes(user, rawPoints) {
  const now = Date.now();
  const byShift = new Map();
  for (const raw of rawPoints) {
    const p = normalizePoint(raw, now);
    if (!p) continue;
    const att = shiftAt(user.id, p.at);
    if (!att) continue;
    if (!byShift.has(att.id)) byShift.set(att.id, { att, points: [] });
    byShift.get(att.id).points.push(p);
  }

  const current = currentShift(user.id, now);
  const onDuty = !!current && !current.checkOutTime;
  let report = reportFor(user, current, false);
  let accepted = 0;
  let latest = null;
  for (const { att, points } of byShift.values()) {
    points.sort((a, b) => a.at - b.at);
    const shiftReport = reportFor(user, att, true);
    for (const p of points) {
      const status=ingest(shiftReport, p);
      // Approximate positions remain useful live observations, but never add
      // poor-accuracy fixes to the employee's travelled route or distance.
      if(!p.mocked && p.accuracy>0 && p.accuracy<=150 && (!latest || p.at>latest.at)) latest={...p,lat:status==='inaccurate'?p.lat:shiftReport.lastLat,lng:status==='inaccurate'?p.lng:shiftReport.lastLng,attendanceId:att.id};
      if (['anchor','moved','still','reanchored'].includes(status)) {
        accepted += 1;
        if (!latest || p.at>latest.at) latest={...p,lat:shiftReport.lastLat,lng:shiftReport.lastLng,attendanceId:att.id};
      }
    }
    shiftReport.attendanceId = att.id;
    shiftReport.employeeName = user.name;
    shiftReport.branch = user.branch;
    upsert('tracking', shiftReport, { deferMs: REPORT_WRITE_DELAY_MS });
    if (current && att.id === current.id) report = shiftReport;
  }
  if (latest) saveLive(user, latest);
  return { onDuty, accepted, totalKm: report?.totalKm || 0, report };
}

/** Single fix sent every ~15 seconds while on duty. */
exports.livePing = (req, res) => {
  const { lat, lng } = req.body || {};
  if (lat == null || lng == null) return error(res, 'lat and lng required');
  const result = recordFixes(req.user, [req.body]);
  return success(res, {
    onDuty: result.onDuty,
    accepted: result.accepted,
    totalKm: result.totalKm,
    lastLat: result.report?.lastLat ?? null,
    lastLng: result.report?.lastLng ?? null,
  });
};
exports.heartbeat=(req,res)=>{
  const body=req.body || {};
  const row={id:req.user.id,userId:req.user.id,receivedAt:new Date().toISOString(),locationEnabled:body.locationEnabled===true,permission:body.permission==='granted'?'granted':'denied',backgroundAllowed:body.backgroundAllowed===true,trackingActive:body.trackingActive===true,appVersion:String(body.appVersion || 'unknown').slice(0,30),issue:String(body.issue || '').slice(0,200)};
  upsert('trackingDevices',row,{deferMs:LIVE_WRITE_DELAY_MS});
  return success(res,{receivedAt:row.receivedAt,onDuty:!!currentShift(req.user.id,Date.now()) && !currentShift(req.user.id,Date.now()).checkOutTime},'App heartbeat received');
};

/** Batch of fixes, e.g. collected while the phone had no internet. */
exports.saveRoutePoints = (req, res) => {
  const { routePoints } = req.body || {};
  if (!Array.isArray(routePoints) || !routePoints.length) return error(res, 'Route points required');
  const result = recordFixes(req.user, routePoints.slice(-MAX_BATCH));
  const report = result.report || { totalKm: 0, routePoints: [] };
  return success(
    res,
    { ...publicReport(report, true), onDuty: result.onDuty, accepted: result.accepted },
    'Route saved'
  );
};

function publicReport(report, withPoints) {
  const {
    anchor,
    anchorSeenAt,
    pendingJump,
    pendingMovement,
    lastFixAt,
    totalMeters,
    gaps,
    path,
    compactedAt,
    routePoints: _raw,
    ...rest
  } = report;
  const points = reportPoints(report);
  if (!withPoints) return { ...rest, routePointCount: points.length };
  const routePoints = points.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
    timestamp: new Date(p.at).toISOString(),
    accuracy: p.accuracy,
    breakBefore:p.breakBefore,
  }));
  return { ...rest, routePoints, routePointCount: points.length };
}

exports.getToday = (req, res) => {
  const report = reportFor(req.user, currentShift(req.user.id, Date.now()), false);
  return success(res, report ? publicReport(report, true) : { totalKm: 0, routePoints: [] });
};

/** Who the viewer may see on the live map. Field staff see only themselves. */
function visibleUsers(viewer, branchFilter) {
  const users = getCollection('users').filter((u) => u.isActive !== false && u.role !== 'admin');
  if (viewer.role === 'fieldOfficer') return users.filter((u) => u.id === viewer.id);
  let team = isAdmin(viewer) ? users : users.filter((u) => sameBranch(viewer, u.branch));
  if (branchFilter) team = team.filter((u) => sameBranch({ branch: branchFilter }, u.branch));
  return team;
}

function canViewTeam(viewer) {
  return isAdmin(viewer) || hasPermission(viewer, 'tracking');
}

function canViewUser(viewer, target) {
  if (!target) return false;
  if (viewer.id === target.id) return true;
  if (viewer.role === 'fieldOfficer') return false;
  if (!canViewTeam(viewer)) return false;
  return isAdmin(viewer) || sameBranch(viewer, target.branch);
}

exports.getLiveTeam = (req, res) => {
  if (req.user.role !== 'fieldOfficer' && !canViewTeam(req.user)) {
    return error(res, 'You do not have access to live tracking', 403);
  }
  const now = Date.now();
  const team = visibleUsers(req.user, req.query.branch);

  const live = team
    .map((u) => {
      const att = currentShift(u.id, now);
      if (!att) return null;
      const loc = findById('liveLocations', u.id);
      const report = reportFor(u, att, false);
      const todayLoc = loc && loc.attendanceId === att.id ? loc : null;
      const lat = todayLoc?.lat ?? report?.lastLat ?? att.checkInLat ?? null;
      const lng = todayLoc?.lng ?? report?.lastLng ?? att.checkInLng ?? null;
      if (lat == null || lng == null) return null;
      const lastSeenAt = todayLoc?.at || report?.endTime || att.checkInTime;
      const age = now - Date.parse(lastSeenAt);
      const heartbeat=findById('trackingDevices',u.id);
      const health=require('../../lib/trackingHealth').trackingHealth({lastFixAt:lastSeenAt,accuracy:todayLoc?.accuracy ?? report?.lastAccuracy,heartbeat,checkedOut:!!att.checkOutTime,now});
      const status=health.status;
      return {
        userId: u.id,
        employeeId: u.employeeId,
        name: u.name,
        branch: u.branch,
        role: u.role,
        lat: Number(lat),
        lng: Number(lng),
        accuracy: todayLoc?.accuracy ?? report?.lastAccuracy ?? null,
        speedKmh: todayLoc?.speed != null ? Math.round(todayLoc.speed * 36) / 10 : null,
        heading: todayLoc?.heading ?? null,
        mocked: !!todayLoc?.mocked || (report?.mockedFixes || 0) > 0,
        lastSeenAt,
        secondsAgo: Math.max(0, Math.round(age / 1000)),
        status,
        deviceOnline:health.deviceOnline,
        statusReason:health.reason,
        appLastSeenAt:heartbeat?.receivedAt || null,
        appVersion:heartbeat?.appVersion || null,
        backgroundAllowed:heartbeat?.backgroundAllowed ?? null,
        onDuty: !att.checkOutTime,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime || null,
        totalKmToday: report?.totalKm || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  return success(res, live);
};

function minStopFrom(query) {
  const n = parseInt(query.minStop || '5', 10);
  return Number.isFinite(n) ? Math.min(120, Math.max(1, n)) : 5;
}

function personInfo(u) {
  return {
    userId: u.id,
    name: u.name,
    employeeId: u.employeeId,
    mobile: u.mobile || '',
    email: u.email || '',
    branch: u.branch,
    role: u.role,
    workType: workTypeOf(u),
  };
}

/** Employees whose routes the viewer may open. */
exports.getPeople = (req, res) => {
  if (req.user.role !== 'fieldOfficer' && !canViewTeam(req.user)) {
    return error(res, 'You do not have access to tracking', 403);
  }
  const people = visibleUsers(req.user, req.query.branch)
    .map((u) => {
      const last = attendancesOf(u.id)[0];
      return { ...personInfo(u), lastDutyAt: last?.checkInTime || null };
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return success(res, { retentionDays: RETENTION_DAYS, people });
};

/** Day-by-day summary for one employee over the stored history (up to 90 days). */
exports.getDays = (req, res) => {
  const target = findById('users', req.query.userId || req.user.id);
  if (!canViewUser(req.user, target)) return error(res, 'You cannot view this employee', 403);
  const now = Date.now();
  const days = Math.min(RETENTION_DAYS, Math.max(1, parseInt(req.query.days || String(RETENTION_DAYS), 10) || RETENTION_DAYS));
  const since = now - days * 86400000;
  const minStopMinutes = minStopFrom(req.query);
  const list = attendancesOf(target.id)
    .filter((a) => Date.parse(a.checkInTime) >= since)
    .map((att) => {
      const report = reportFor(target, att, false);
      const { summary } = analyzeShift(report, att, { minStopMinutes, now });
      return {
        date: attendanceDay(att.checkInTime),
        attendanceId: att.id,
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime || null,
        ...summary,
      };
    });
  return success(res, { person: personInfo(target), retentionDays: RETENTION_DAYS, days: list });
};

/** One employee's full route for a shift: path, stops, travel legs, signal gaps. */
exports.getRoute = (req, res) => {
  const userId = req.query.userId || req.user.id;
  const target = findById('users', userId);
  if (!canViewUser(req.user, target)) return error(res, 'You cannot view this route', 403);
  const date = String(req.query.date || '');
  const shifts = attendancesOf(target.id);
  const att = req.query.attendanceId
    ? shifts.find((a) => a.id === req.query.attendanceId) || null
    : /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? shifts.find((a) => attendanceDay(a.checkInTime) === date) || null
      : currentShift(target.id, Date.now());
  const report = reportFor(target, att, false);
  const analysis = analyzeShift(report, att, { minStopMinutes: minStopFrom(req.query) });
  return success(res, {
    ...personInfo(target),
    date: att ? attendanceDay(att.checkInTime) : date || attendanceDay(),
    attendanceId: att?.id || null,
    totalKm: report?.totalKm || 0,
    checkInTime: att?.checkInTime || null,
    checkOutTime: att?.checkOutTime || null,
    checkIn: att ? { lat: att.checkInLat ?? null, lng: att.checkInLng ?? null } : null,
    checkOut: att?.checkOutTime ? { lat: att.checkOutLat ?? null, lng: att.checkOutLng ?? null } : null,
    ...analysis,
  });
};

/**
 * Deletes routes older than the retention window and shrinks finished days.
 * Returns counts for logging.
 */
function runMaintenance(now = Date.now()) {
  const cutoff = now - RETENTION_DAYS * 86400000;
  const tracking = getCollection('tracking');
  const kept = tracking.filter((t) => Date.parse(t.startTime || t.date) >= cutoff);
  const removed = tracking.length - kept.length;
  if (removed) saveCollection('tracking', kept);

  const live = getCollection('liveLocations');
  const freshLive = live.filter((l) => Date.parse(l.at || 0) >= now - 2 * 86400000);
  if (freshLive.length !== live.length) saveCollection('liveLocations', freshLive);

  const attendance = getCollection('attendance');
  let compacted = 0;
  for (const t of kept) {
    if (t.compactedAt || !Array.isArray(t.routePoints) || !t.routePoints.length) continue;
    const att = t.attendanceId ? attendance.find((a) => a.id === t.attendanceId) : null;
    const closedAt = att?.checkOutTime
      ? Date.parse(att.checkOutTime)
      : Date.parse(t.startTime || t.date) + MAX_SHIFT_MS;
    if (now - closedAt < 6 * 3600000) continue;
    compactReport(t);
    upsert('tracking', t, { single: true });
    compacted += 1;
  }
  return { removed, compacted };
}

exports.runMaintenance = runMaintenance;

/** Runs maintenance now and every 6 hours. */
exports.startMaintenance = () => {
  const run = () => {
    try {
      const r = runMaintenance();
      if (r.removed || r.compacted) {
        console.log(`Tracking maintenance: removed ${r.removed} old day(s), compacted ${r.compacted}`);
      }
    } catch (err) {
      console.error('Tracking maintenance failed:', err.message);
    }
  };
  setTimeout(run, 60 * 1000).unref?.();
  setInterval(run, 6 * 3600 * 1000).unref?.();
};

exports.getHistory = (req, res) => {
  const users = getCollection('users');
  let tracking = getCollection('tracking');
  if (req.user.role === 'fieldOfficer') {
    tracking = tracking.filter((t) => t.userId === req.user.id);
  } else {
    if (!canViewTeam(req.user)) return error(res, 'You do not have access to tracking', 403);
    tracking = tracking.filter((t) => canViewUser(req.user, users.find((u) => u.id === t.userId)));
  }
  const list = tracking
    .map((t) => publicReport(t, false))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return success(res, list);
};
