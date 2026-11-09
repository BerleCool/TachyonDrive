const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../.core-test/trips.js');
const start = Date.parse('2026-11-09T12:00:00Z');
const prefs = { ...E.DEFAULT_PREFERENCES, litresPer100Km: 6, pricePerLitre: 15 };
const trip = () => E.newTrip('test', start, prefs);
const fix = (offset = 0, lat = 56.15, speed = 10, accuracy = 4) => ({ latitude: lat, longitude: 10.20, timestamp: start + offset, speed, accuracy });
test('accounting remains consistent across many mixed-quality fixes', () => {
  let t = trip();
  for (let i = 0; i < 1000; i++) t = E.ingest(t, fix(i * 1000, 56.15 + i * .00008, i % 11 === 0 ? 0 : 9, i % 17 === 0 ? 80 : 4));
  const accounted = Object.values(t.slices).reduce((sum, day) => sum + day.metres, 0);
  assert.ok(Number.isFinite(t.metres)); assert.ok(t.metres >= 0);
  assert.ok(Math.abs(accounted - t.metres) < 1e-6);
  const month = E.totals([t], '2026-11');
  assert.ok(Math.abs(month.cost - E.estimate(t.metres, t.rates).cost) < 1e-6);
});
test('local day boundaries handle a full 25-hour DST day', () => {
  const start = Date.parse('2026-10-24T22:00:00Z');
  const end = Date.parse('2026-10-25T23:00:00Z');
  const slices = E.allocate({}, start, end, 25000, end - start, 'Europe/Copenhagen');
  assert.deepEqual(Object.keys(slices), ['2026-10-25']);
  assert.equal(slices['2026-10-25'].trackedMs, 25 * 3600 * 1000);
});
