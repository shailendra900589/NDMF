const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trackingHealth } = require('../src/lib/trackingHealth');

test('native on-duty stays delayed (not offline) when signal is a few minutes stale', () => {
  const now = Date.now();
  const fourMinAgo = new Date(now - 4 * 60 * 1000).toISOString();
  const health = trackingHealth({
    lastFixAt: fourMinAgo,
    accuracy: 12,
    heartbeat: {
      receivedAt: fourMinAgo,
      trackingEngine: 'android_native',
      trackingActive: true,
      locationEnabled: true,
      permission: 'granted',
      backgroundAllowed: true,
      networkAvailable: true,
      airplaneMode: false,
    },
    checkedOut: false,
    now,
  });
  assert.equal(health.status, 'delayed');
  assert.equal(health.deviceOnline, false);
});

test('GPS ingest timestamp keeps device online when heartbeat HTTP lags', () => {
  const now = Date.now();
  const health = trackingHealth({
    lastFixAt: new Date(now - 45 * 1000).toISOString(),
    accuracy: 10,
    heartbeat: {
      receivedAt: new Date(now - 150 * 1000).toISOString(),
      lastFixReceivedAt: new Date(now - 45 * 1000).toISOString(),
      trackingEngine: 'android_native',
      trackingActive: true,
      locationEnabled: true,
      permission: 'granted',
      backgroundAllowed: true,
      networkAvailable: true,
    },
    checkedOut: false,
    now,
  });
  assert.equal(health.deviceOnline, true);
  assert.equal(health.status, 'live');
});
