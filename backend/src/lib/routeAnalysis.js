/**
 * ROUTE ANALYSIS — turns one shift's GPS path into stops, travel legs,
 * signal gaps and a timeline for the admin panel.
 */
const { haversineMeters, reportPoints } = require('./gpsTrack');

const DEFAULT_MIN_STOP_MIN = 5;
/** Two stops this close with only a short hop between them are one stop. */
const MERGE_RADIUS_M = 60;
const MERGE_HOP_MS = 2 * 60 * 1000;
const MIN_GAP_MS = 3 * 60 * 1000;

const minutes = (ms) => Math.max(0, Math.round(ms / 60000));
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function pathMeters(points, from, to) {
  let m = 0;
  for (let i = from + 1; i <= to; i += 1) m += haversineMeters(points[i - 1], points[i]);
  return m;
}

/**
 * @param report  tracking day report (may be null)
 * @param att     attendance record of the shift
 * @param opts    { minStopMinutes, now }
 */
function analyzeShift(report, att, { minStopMinutes = DEFAULT_MIN_STOP_MIN, now = Date.now() } = {}) {
  const points = reportPoints(report);
  const minStopMs = Math.max(1, minStopMinutes) * 60000;
  const checkIn = att?.checkInTime ? Date.parse(att.checkInTime) : points[0]?.at || null;
  const checkOut = att?.checkOutTime ? Date.parse(att.checkOutTime) : null;
  const lastFix = report?.lastFixAt || points[points.length - 1]?.at || null;
  const onDuty = !!att && !checkOut;
  const end = checkOut || (onDuty ? now : lastFix) || checkIn;

  // Each path point is a place the person reached; they stayed until leftAt.
  const visits = points.map((p, i) => {
    const departure = p.leftAt || (i < points.length - 1 ? points[i + 1].at : lastFix || p.at);
    return { index: i, lat: p.lat, lng: p.lng, arrivedAt: p.at, leftAt: Math.max(p.at, departure) };
  });

  const stops = [];
  for (const v of visits) {
    if (v.leftAt - v.arrivedAt < minStopMs) continue;
    const prev = stops[stops.length - 1];
    if (
      prev &&
      haversineMeters(prev, v) <= MERGE_RADIUS_M &&
      v.arrivedAt - prev.leftAt <= MERGE_HOP_MS
    ) {
      prev.leftAt = v.leftAt;
      prev.endIndex = v.index;
      continue;
    }
    stops.push({ ...v, startIndex: v.index, endIndex: v.index });
  }
  const lastIndex = points.length - 1;
  stops.forEach((s, i) => {
    s.number = i + 1;
    s.minutes = minutes(s.leftAt - s.arrivedAt);
    s.ongoing = onDuty && s.endIndex === lastIndex;
    s.isStart = s.startIndex === 0;
  });

  // Travel legs: from leaving one place where the person stayed to reaching the next.
  const legs = [];
  if (points.length) {
    let fromIndex = 0;
    let fromAt = visits[0].leftAt;
    if (stops[0]?.isStart) {
      fromIndex = stops[0].endIndex;
      fromAt = stops[0].leftAt;
    }
    const pushLeg = (toIndex, toAt) => {
      if (toIndex <= fromIndex) return;
      const meters = pathMeters(points, fromIndex, toIndex);
      if (meters < 30) return;
      legs.push({ startAt: fromAt, endAt: toAt, from: {lat:points[fromIndex].lat,lng:points[fromIndex].lng}, to:{lat:points[toIndex].lat,lng:points[toIndex].lng}, km: Math.round(meters / 10) / 100, minutes: minutes(toAt - fromAt) });
    };
    for (const s of stops) {
      if (s.isStart) continue;
      pushLeg(s.startIndex, s.arrivedAt);
      fromIndex = s.endIndex;
      fromAt = s.leftAt;
    }
    pushLeg(lastIndex, points[lastIndex].at);
  }

  const gaps = (report?.gaps || [])
    .filter((g) => g.to - g.from >= MIN_GAP_MS)
    .map((g) => ({ from: g.from, to: g.to, minutes: minutes(g.to - g.from) }));

  const stoppedMs = stops.reduce((s, x) => s + (x.leftAt - x.arrivedAt), 0);
  const movingMs = legs.reduce((s, l) => s + Math.max(0, l.endAt - l.startAt), 0);
  const movingKm = legs.reduce((s, l) => s + l.km, 0);
  const longest = stops.reduce((m, s) => Math.max(m, s.minutes), 0);

  const timeline = [];
  if (checkIn) {
    timeline.push({ type: 'checkin', at: iso(checkIn), lat: att?.checkInLat ?? points[0]?.lat ?? null, lng: att?.checkInLng ?? points[0]?.lng ?? null });
  }
  stops.forEach((s) =>
    timeline.push({
      type: 'stop',
      at: iso(s.arrivedAt),
      until: iso(s.leftAt),
      minutes: s.minutes,
      number: s.number,
      lat: s.lat,
      lng: s.lng,
      ongoing: s.ongoing,
      isStart: s.isStart,
    })
  );
  legs.forEach((l) => timeline.push({ type: 'travel', at: iso(l.startAt), until: iso(l.endAt), from:l.from, to:l.to, km: l.km, minutes: l.minutes }));
  // A stored gap means an upload was delayed; it does not prove that the phone
  // had no GPS. Keep it for audit without falsely reporting a GPS outage.
  gaps.forEach((g) => timeline.push({ type: 'sync_delay', at: iso(g.from), until: iso(g.to), minutes: g.minutes }));
  if (checkOut) {
    timeline.push({ type: 'checkout', at: iso(checkOut), lat: att?.checkOutLat ?? null, lng: att?.checkOutLng ?? null });
  }
  const order = { checkin: 0, stop: 1, travel: 2, sync_delay: 3, checkout: 4 };
  timeline.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || order[a.type] - order[b.type]);

  return {
    points: points.map((p) => ({ lat: p.lat, lng: p.lng, at: iso(p.at), accuracy: p.accuracy })),
    stops: stops.map((s) => ({
      number: s.number,
      lat: s.lat,
      lng: s.lng,
      arrivedAt: iso(s.arrivedAt),
      leftAt: iso(s.leftAt),
      minutes: s.minutes,
      ongoing: s.ongoing,
      isStart: s.isStart,
    })),
    gaps: gaps.map((g) => ({ from: iso(g.from), to: iso(g.to), minutes: g.minutes })),
    timeline,
    summary: {
      totalKm: report?.totalKm || 0,
      dutyMinutes: checkIn && end ? minutes(end - checkIn) : 0,
      movingMinutes: minutes(movingMs),
      stoppedMinutes: minutes(stoppedMs),
      signalLostMinutes: gaps.reduce((s, g) => s + g.minutes, 0),
      stopCount: stops.length,
      longestStopMinutes: longest,
      avgSpeedKmh: movingMs > 60000 ? Math.round((movingKm / (movingMs / 3600000)) * 10) / 10 : 0,
      pointCount: points.length,
      firstFixAt: iso(points[0]?.at),
      lastFixAt: iso(lastFix),
      onDuty,
    },
  };
}

module.exports = { analyzeShift, DEFAULT_MIN_STOP_MIN };
