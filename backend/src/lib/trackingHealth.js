/** Fresh GPS fix → Live / weak GPS (matches admin map). */
const LIVE_GPS_MS = 60 * 1000;
/** Heartbeat or GPS ingest counts as “device connected”. */
const DEVICE_SIGNAL_MS = 3 * 60 * 1000;
/** On-duty native duty tracking: show Delayed instead of Offline until this age. */
const DELAYED_MAX_MS = 10 * 60 * 1000;
/** After this, both signals stale → offline. */
const OFFLINE_MAX_MS = 12 * 60 * 1000;

function ageMs(iso, now) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return now - t;
}

function trackingHealth({ lastFixAt, accuracy, heartbeat, checkedOut, now = Date.now() }) {
  const gpsAge = ageMs(lastFixAt, now);
  const heartbeatAge = ageMs(heartbeat?.receivedAt, now);
  const ingestedGpsAge = ageMs(heartbeat?.lastGpsAt || heartbeat?.lastFixReceivedAt, now);
  const signalAge = Math.min(heartbeatAge, ingestedGpsAge, gpsAge);

  const nativeDuty =
    heartbeat?.trackingEngine === 'android_native' && heartbeat?.trackingActive !== false;

  const deviceOnline = signalAge <= DEVICE_SIGNAL_MS;

  if (checkedOut) {
    return { status: 'checked_out', deviceOnline, reason: 'Shift has ended' };
  }
  const hb = heartbeat && heartbeat.receivedAt ? heartbeat : null;

  if (deviceOnline && hb?.airplaneMode === true) {
    return {
      status: 'airplane_mode',
      deviceOnline,
      reason: 'Phone is in airplane mode. Location and updates are interrupted until it is turned off.',
    };
  }
  if (deviceOnline && hb?.locationEnabled === false) {
    return {
      status: 'location_off',
      deviceOnline,
      reason: 'Phone location / GPS is switched off. Enable location in phone settings.',
    };
  }
  if (deviceOnline && hb?.networkAvailable === false) {
    return {
      status: 'no_network',
      deviceOnline,
      reason: 'Phone has no internet. GPS may still collect locally; admin updates resume when data returns.',
    };
  }
  if (deviceOnline && hb && hb.permission !== 'granted') {
    return {
      status: 'permission_required',
      deviceOnline,
      reason: 'Location permission is missing on the phone.',
    };
  }
  if (deviceOnline && hb?.backgroundAllowed === false) {
    return {
      status: 'background_required',
      deviceOnline,
      reason: 'Background location is not allowed. Ask the employee to choose “Allow all the time”.',
    };
  }
  if (deviceOnline && hb?.trackingActive === false) {
    return {
      status: 'gps_pending',
      deviceOnline,
      reason: 'App connected; duty GPS service is not active. Open Attendance to resume duty tracking.',
    };
  }

  if (gpsAge <= LIVE_GPS_MS) {
    if (accuracy != null && accuracy > 35) {
      return {
        status: 'weak_gps',
        deviceOnline: true,
        reason: 'Fresh GPS received with reduced accuracy; excluded from travelled distance.',
      };
    }
    return { status: 'live', deviceOnline: true, reason: 'Recent GPS observation received' };
  }

  if (deviceOnline) {
    return {
      status: 'gps_pending',
      deviceOnline,
      reason: hb?.issue || 'App connected; waiting for a fresh GPS fix.',
    };
  }

  const delayedWindow = nativeDuty ? DELAYED_MAX_MS : 5 * 60 * 1000;
  if (signalAge <= delayedWindow || gpsAge <= delayedWindow) {
    return {
      status: 'delayed',
      deviceOnline: false,
      reason: nativeDuty
        ? 'Duty GPS updates are slow. Phone may be locked or saving battery — data should resume when the device reconnects.'
        : 'GPS updates are delayed. Check app background access and connection.',
    };
  }

  if (signalAge <= OFFLINE_MAX_MS && nativeDuty) {
    return {
      status: 'delayed',
      deviceOnline: false,
      reason: 'Duty tracking signal is stale. Previous route data is kept; open the app if this persists.',
    };
  }

  return {
    status: 'offline',
    deviceOnline: false,
    reason:
      'No recent duty GPS or app signal. Open the app once and confirm background location and battery settings.',
  };
}

module.exports = {
  trackingHealth,
  LIVE_GPS_MS,
  DEVICE_SIGNAL_MS,
  DELAYED_MAX_MS,
  OFFLINE_MAX_MS,
};
