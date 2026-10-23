import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefsWithZone, quietState, quietZone } from '../services/notifications.js';

import { bounds as dashboardBounds } from '../modules/dashboard/data.js';

const portal = { timeZone: 'Asia/Bishkek', dateFormat: 'DD.MM.YYYY', timeFormat: '24', weekStart: 1 };
const ny = { timeZone: 'America/New_York', dateFormat: 'MM/DD/YYYY', timeFormat: '12', weekStart: 0, locale: 'en' };

test('quiet hours: own region zone, then the legacy notify_prefs.tz, then the device, then the portal', () => {
  assert.equal(quietZone({ regional: { timeZone: 'Europe/Berlin' }, notify_prefs: { tz: 'Asia/Tokyo' } }, portal), 'Europe/Berlin');
  assert.equal(quietZone({ regional: { timeZone: 'device' }, device_tz: 'Europe/Moscow' }, portal), 'Europe/Moscow');
  assert.equal(quietZone({ regional: {}, notify_prefs: { tz: 'Asia/Tokyo' }, device_tz: 'Europe/Moscow' }, portal), 'Asia/Tokyo');
  assert.equal(quietZone({ regional: {}, device_tz: 'Europe/Moscow' }, portal), 'Europe/Moscow');
  assert.equal(quietZone({ regional: {} }, portal), 'Asia/Bishkek');
  assert.equal(quietZone(null, portal), 'Asia/Bishkek');
  // 22:00–08:00 in New York: 03:00 UTC is 23:00 there.
  const prefs = prefsWithZone({ regional: { timeZone: 'America/New_York' }, notify_prefs: { quiet: { enabled: true, from: '22:00', to: '08:00' } } }, portal);
  assert.equal(prefs.tz, 'America/New_York');
  assert.equal(quietState(prefs, new Date('2026-10-14T03:00:00Z')), 'quiet');
  assert.equal(quietState(prefs, new Date('2026-10-14T15:00:00Z')), null);
});

test('dashboard day bounds are local midnights, DST included', () => {
  const b = dashboardBounds('Europe/Berlin', 3, new Date('2026-03-30T10:00:00Z'));
  assert.equal(b.today.toISOString(), '2026-03-29T22:00:00.000Z');
  assert.equal(b.tomorrow.toISOString(), '2026-03-30T22:00:00.000Z');
  assert.equal(b.since.toISOString(), '2026-03-27T23:00:00.000Z', 'before the switch to summer time');
});
