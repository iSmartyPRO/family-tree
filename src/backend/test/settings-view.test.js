import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPool } from '../config/database.js';
import { MODULE_CATALOG } from '../modules/catalog.js';
import { getSettings, getSettingsView, invalidateSettings, parseSettings } from '../services/settings.js';

/*
 * The parsed settings view of the hot paths (getSettingsView) and the CRM stock-list migration,
 * without a database: the pool's query is replaced by a fake.
 */

function fakeRows(rowsFor) {
  const pool = getPool();
  const original = pool.query;
  pool.query = (text, params) => rowsFor(text, params);
  return () => {
    pool.query = original;
  };
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const rows = (appName) => ({ rows: [{ key: 'app_name', value: appName }] });

test('getSettingsView: two loads that settle together never store the older parse', async () => {
  const pending = [];
  const restore = fakeRows(() => {
    const next = deferred();
    pending.push(next);
    return next.promise;
  });
  try {
    invalidateSettings();
    const first = getSettingsView();
    await Promise.resolve();
    invalidateSettings(); // an admin save between the two reads
    const second = getSettingsView();
    await Promise.resolve();
    assert.equal(pending.length, 2);
    // Both answers arrive in the same microtask drain, the newer one first.
    pending[1].resolve(rows('New name'));
    pending[0].resolve(rows('Old name'));
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.appName, 'Old name', 'each caller gets the parse of its own load');
    assert.equal(b.appName, 'New name');
    // The cached view is the newer snapshot, served without another query.
    const again = await getSettingsView();
    assert.equal(again.appName, 'New name');
    assert.equal(pending.length, 2, 'served from the cache');
    assert.equal(await getSettingsView(), again, 'same frozen object while the raw cache lasts');
  } finally {
    restore();
    invalidateSettings();
  }
});

test('getSettingsView: a read that started before an invalidation does not fill the cache', async () => {
  const pending = [];
  const restore = fakeRows(() => {
    const next = deferred();
    pending.push(next);
    return next.promise;
  });
  try {
    invalidateSettings();
    const stale = getSettings();
    await Promise.resolve();
    invalidateSettings();
    pending[0].resolve(rows('Before save'));
    assert.equal((await stale).app_name, 'Before save');
    const view = getSettingsView();
    await Promise.resolve();
    assert.equal(pending.length, 2, 'the stale answer was not cached');
    pending[1].resolve(rows('After save'));
    assert.equal((await view).appName, 'After save');
  } finally {
    restore();
    invalidateSettings();
  }
});

/* ── CRM stock lists: stored once, never relabelled ───────────────────────── */

function fakeClient({ modules, deals = 0, dealsTable = true }) {
  const state = { modules: modules === undefined ? undefined : JSON.stringify(modules), writes: 0 };
  const client = {
    async query(text, params) {
      if (/to_regclass/.test(text)) return { rows: [{ t: dealsTable ? 'crm_deals' : null }] };
      if (/FROM crm_deals/.test(text)) return { rows: deals ? [{ '?column?': 1 }] : [] };
      if (/SELECT value FROM app_settings/.test(text)) return { rows: state.modules === undefined ? [] : [{ value: state.modules }] };
      if (/INSERT INTO app_settings/.test(text)) {
        state.modules = params[0];
        state.writes += 1;
        return { rowCount: 1 };
      }
      throw new Error(`unexpected query ${text}`);
    },
  };
  const transaction = (fn) => fn(client);
  return { state, transaction, stored: () => JSON.parse(state.modules) };
}

