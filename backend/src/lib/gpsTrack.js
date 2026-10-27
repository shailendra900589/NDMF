/**
 * GPS TRACK — turns raw phone fixes into an accurate travelled distance.
 *
 * Phones report a position every ~15s with an accuracy radius. Even when a
 * person stands still, consecutive fixes wander by 5–40 m, and adding those
 * wobbles up inflates the day's KM. Distance is therefore counted only from a
 * fixed "anchor" point once the person has clearly moved beyond the combined
 * accuracy of both fixes, and impossible jumps are ignored.
 */

/** Fixes worse than this are shown on the map but never counted as travel. */
const MAX_ACCURACY_FOR_DISTANCE_M = 35;
/** Fixes worse than this are not even shown as the live position. */
const MAX_ACCURACY_FOR_LIVE_M = 150;
/** Accuracy assumed when an older app version does not send it. */
const DEFAULT_ACCURACY_M = 20;
const MIN_STEP_M = 20;
const MAX_STEP_M = 60;
/** ~200 km/h. Anything faster between two fixes is a GPS glitch. */
const MAX_SPEED_MPS = 55;
/** After this many consistent "jumped" fixes, accept the new place without adding distance. */
const JUMP_CONFIRMATIONS = 3;
const MAX_TRAIL_POINTS = 6000;
/** Android may batch location updates while the device is locked. Short upload
 * gaps are not a GPS outage, so only call a real delayed sync after 12 min. */
const GAP_MS = 12 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

function toRad(v) {
  return (v * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const R = 6371008.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Accepts a fix from the app (`lat/lng` or `latitude/longitude`) and returns a
 * clean point, or null when it is unusable.
 */
function normalizePoint(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = num(raw.lat ?? raw.latitude);
  const lng = num(raw.lng ?? raw.longitude);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return null;

  let at = Date.parse(raw.recordedAt ?? raw.timestamp ?? raw.time ?? '');
  if (!Number.isFinite(at) || at > now + FUTURE_TOLERANCE_MS) return null;
  if (at < now - MAX_AGE_MS) return null;

  const accuracy = num(raw.accuracy);
  const speed = num(raw.speed);
  const heading = num(raw.heading);
  return {
    lat,
    lng,
    accuracy: accuracy != null && accuracy >= 0 ? Math.round(accuracy * 10) / 10 : null,
    speed: speed != null && speed >= 0 ? Math.round(speed * 100) / 100 : null,
    heading: heading != null && heading >= 0 ? Math.round(heading) : null,
    at,
    mocked: raw.mocked === true || raw.isMocked === true,
  };
}

function trailPoint(p) {
  return {
    latitude: p.lat,
    longitude: p.lng,
    timestamp: new Date(p.at).toISOString(),
    accuracy: p.accuracy,
  };
}

/**
 * Adds one fix to a day report and updates its distance.
 * Points must arrive in time order; older or repeated fixes are ignored.
 * Returns what happened, for logging and tests.
 */
function ingest(report, point) {
  if (point.mocked) { report.mockedFixes=(report.mockedFixes || 0)+1; return 'mocked'; }
  if (point.accuracy == null || point.accuracy <= 0 || point.accuracy > MAX_ACCURACY_FOR_DISTANCE_M) return 'inaccurate';
  if (report.totalMeters == null) report.totalMeters = Math.round((report.totalKm || 0) * 1000);
  expandPath(report);
  if (!Array.isArray(report.routePoints)) report.routePoints = [];

  if (report.lastFixAt && point.at <= report.lastFixAt) return 'old';
  const largeGap=report.lastFixAt && point.at-report.lastFixAt>=GAP_MS;
  if (report.lastFixAt && point.at - report.lastFixAt >= GAP_MS) {
    if (!Array.isArray(report.gaps)) report.gaps = [];
    report.gaps.push({ from: report.lastFixAt, to: point.at });
    if (report.gaps.length > 500) report.gaps.splice(0, report.gaps.length - 500);
  }
  report.lastFixAt = point.at;

  if (point.accuracy == null || point.accuracy <= MAX_ACCURACY_FOR_LIVE_M) {
    report.lastLat = point.lat;
    report.lastLng = point.lng;
    report.lastAccuracy = point.accuracy;
  }
  report.endTime = new Date(point.at).toISOString();

  if (point.mocked) {
    report.mockedFixes = (report.mockedFixes || 0) + 1;
    return 'mocked';
  }

  const accuracy = point.accuracy ?? DEFAULT_ACCURACY_M;
  if (accuracy > MAX_ACCURACY_FOR_DISTANCE_M) return 'inaccurate';

  const anchor = report.anchor;
  if(anchor && largeGap){markLeft(report);report.anchor={lat:point.lat,lng:point.lng,accuracy,at:point.at};report.anchorSeenAt=point.at;report.pendingMovement=null;report.routePoints.push({...trailPoint(point),breakBefore:true});return 'reanchored';}
  if (!anchor) {
    report.anchor = { lat: point.lat, lng: point.lng, accuracy, at: point.at };
    report.anchorSeenAt = point.at;
    report.routePoints.push(trailPoint(point));
    return 'anchor';
  }

  const meters = haversineMeters(anchor, point);
  const seconds = (point.at - (report.anchorSeenAt || anchor.at)) / 1000;
  const threshold = Math.min(MAX_STEP_M, Math.max(MIN_STEP_M, anchor.accuracy + accuracy));
  const still = meters < threshold || (point.speed != null && point.speed < 0.5 && meters < threshold * 2);
  if (still) {
    report.pendingMovement = null;
    report.lastLat=anchor.lat;report.lastLng=anchor.lng;
    report.anchorSeenAt = point.at;
    return 'still';
  }

  if (seconds <= 0 || meters / seconds > MAX_SPEED_MPS) {
    const pending = (report.pendingJump || []).concat({ lat: point.lat, lng: point.lng, accuracy, at: point.at });
    const recent = pending.slice(-JUMP_CONFIRMATIONS);
    const consistent =
      recent.length === JUMP_CONFIRMATIONS &&
      recent.every((p, i) => i === 0 || haversineMeters(recent[i - 1], p) < 150);
    if (consistent) {
      markLeft(report);
      report.anchor = recent[recent.length - 1];
      report.anchorSeenAt = point.at;
      report.pendingJump = [];
      report.pendingMovement=null;
      report.routePoints.push({...trailPoint(point),breakBefore:true});
      return 'reanchored';
    }
    report.pendingJump = recent;
    report.lastLat=anchor.lat;report.lastLng=anchor.lng;
    return 'jump';
  }

  report.pendingJump = [];
  // A single stray fix must not create an excursion out and back. Confirm
  // movement with another independent fix before moving the distance anchor.
  const candidate=report.pendingMovement;
  const stationary=point.speed != null && point.speed < 0.5;
  if (stationary || !candidate || point.at-candidate.at > 90000 || haversineMeters(candidate,point) > Math.max(100,meters*0.75)) {
    report.pendingMovement={lat:point.lat,lng:point.lng,at:point.at};
    report.lastLat=anchor.lat;report.lastLng=anchor.lng;
    return 'pending';
  }
  report.pendingMovement=null;
  markLeft(report);
  report.totalMeters += meters;
  report.totalKm = Math.round(report.totalMeters / 10) / 100;
  report.anchor = { lat: point.lat, lng: point.lng, accuracy, at: point.at };
  report.anchorSeenAt = point.at;
  report.routePoints.push(trailPoint(point));
  if (report.routePoints.length > MAX_TRAIL_POINTS) {
    report.routePoints.splice(1, report.routePoints.length - MAX_TRAIL_POINTS);
  }
  return 'moved';
}

/** The last clear fix at the previous place is when the person left it. */
function markLeft(report) {
  const prev = report.routePoints[report.routePoints.length - 1];
  if (prev && report.anchorSeenAt) prev.leftAt = new Date(report.anchorSeenAt).toISOString();
}

/**
 * Closed days are stored compactly as `path` rows:
 * [lat, lng, arrivedAtSec, leftAtSec (0 = none), accuracy].
 */
function expandPath(report) {
  if (!Array.isArray(report.path)) return;
  report.routePoints = report.path.map(([lat, lng, at, left, acc, split]) => ({
    latitude: lat,
    longitude: lng,
    timestamp: new Date(at * 1000).toISOString(),
    accuracy: acc || null,
    ...(split?{breakBefore:true}:{}),
    ...(left ? { leftAt: new Date(left * 1000).toISOString() } : {}),
  }));
  delete report.path;
  delete report.compactedAt;
}

/** Route points of a report as { lat, lng, at, leftAt, accuracy } with times in ms. */
function reportPoints(report) {
  if (!report) return [];
  if (Array.isArray(report.path)) {
    return report.path.map(([lat, lng, at, left, acc, split]) => ({
      lat,
      lng,
      at: at * 1000,
      leftAt: left ? left * 1000 : null,
      accuracy: acc || null,
      breakBefore:!!split,
    }));
  }
  return (report.routePoints || [])
    .map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      at: Date.parse(p.timestamp),
      leftAt: p.leftAt ? Date.parse(p.leftAt) : null,
      accuracy: p.accuracy ?? null,
      breakBefore:p.breakBefore===true,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.at))
    .sort((a, b) => a.at - b.at);
}

/** Perpendicular distance (m) from p to segment a–b on a local flat projection. */
function offsetFromSegment(p, a, b) {
  const k = Math.cos((a.lat * Math.PI) / 180) * 111320;
  const ax = 0;
  const ay = 0;
  const bx = (b.lng - a.lng) * k;
  const by = (b.lat - a.lat) * 110540;
  const px = (p.lng - a.lng) * k;
  const py = (p.lat - a.lat) * 110540;
  const len2 = bx * bx + by * by;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0;
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Shrinks a finished day for long-term storage. Straight stretches lose
 * redundant points (within 6 m of the line); places where the person stayed
 * and the edges of signal gaps are always kept.
 */
function compactReport(report) {
  const pts = reportPoints(report);
  if (!pts.length) return report;
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const gaps = report.gaps || [];
  pts.forEach((p, i) => {
    if(p.breakBefore){keep[i]=true;if(i>0)keep[i-1]=true;}
    if (p.leftAt && p.leftAt - p.at >= 60 * 1000) keep[i] = true;
    const next = pts[i + 1];
    if (next && gaps.some((g) => g.from >= p.at && g.to <= next.at + 1000)) {
      keep[i] = true;
      keep[i + 1] = true;
    }
  });
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let worst = -1;
    let worstAt = -1;
    for (let i = s + 1; i < e; i += 1) {
      const d = offsetFromSegment(pts[i], pts[s], pts[e]);
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }
    if (worst > 6) {
      keep[worstAt] = true;
      stack.push([s, worstAt], [worstAt, e]);
    }
  }
  report.path = pts
    .filter((_, i) => keep[i])
    .map((p) => [
      Math.round(p.lat * 1e6) / 1e6,
      Math.round(p.lng * 1e6) / 1e6,
      Math.round(p.at / 1000),
      p.leftAt ? Math.round(p.leftAt / 1000) : 0,
      p.accuracy ? Math.round(p.accuracy) : 0,
      p.breakBefore ? 1 : 0,
    ]);
  report.compactedAt = new Date().toISOString();
  delete report.routePoints;
  delete report.anchor;
  delete report.pendingJump;
  delete report.pendingMovement;
  return report;
}

module.exports = {
  haversineMeters,
  normalizePoint,
  ingest,
  reportPoints,
  compactReport,
  expandPath,
  MAX_ACCURACY_FOR_LIVE_M,
};
