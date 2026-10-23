import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { prunePreviewCaches } from '../modules/shared/storage.js';
import { lockQuota } from '../modules/files/service.js';

const future = new Date(Date.now() + 3600_000);
const past = new Date(Date.now() - 1000);

test('preview caches drop files nobody used for 30 days', async () => {
  const root = await mkdtemp(join(tmpdir(), 'previews-'));
  try {
    await mkdir(join(root, 'thumbs'), { recursive: true });
    const old = new Date(Date.now() - 40 * 86400_000);
    const recent = new Date(Date.now() - 2 * 86400_000);
    const files = {
      'old.pdf': old,
      'recent.pdf': recent,
      'thumbs/old.jpg': old,
      'thumbs/new.jpg': new Date(),
      'stale.pdf.abcd.tmp': recent,
    };
    for (const [name, time] of Object.entries(files)) {
      await writeFile(join(root, name), 'x');
      await utimes(join(root, name), time, time);
    }
    const removed = await prunePreviewCaches({ dirs: [root, join(root, 'missing')] });
    assert.equal(removed, 3);
    assert.deepEqual((await readdir(root)).sort(), ['recent.pdf', 'thumbs']);
    assert.deepEqual(await readdir(join(root, 'thumbs')), ['new.jpg']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('quota checks of one person are serialised by an advisory lock', async () => {
  const calls = [];
  await lockQuota({ query: async (sql, params) => calls.push({ sql, params }) }, 42);
  assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(calls[0].params, ['fs-quota:42']);
});

