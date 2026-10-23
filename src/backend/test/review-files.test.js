import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FILE_CSP, contentDisposition, hasSignature, readHead, signatureMatches } from '../modules/shared/storage.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

test('content disposition: inline / attachment, ASCII fallback, no header injection', () => {
  assert.equal(contentDisposition('a.pdf', true), `inline; filename="a.pdf"; filename*=UTF-8''a.pdf`);
  const value = contentDisposition('Отчёт "1".pdf\r\nX-Evil: 1');
  assert.ok(value.startsWith('attachment; filename="'));
  assert.ok(!/[\r\n]/.test(value), 'no CR/LF');
  assert.match(value, /^attachment; filename="_____ 1\.pdf  X-Evil: 1"; filename\*=/, 'non-ASCII becomes _, quotes are dropped');
  assert.ok(value.includes(`filename*=UTF-8''${encodeURIComponent('Отчёт "1".pdf  X-Evil: 1')}`));
  for (const part of ['sandbox', "form-action 'none'", "frame-ancestors 'self'", "default-src 'none'"]) assert.ok(FILE_CSP.includes(part), part);
});

test('magic bytes: header read and signature match', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-files-'));
  try {
    const png = join(dir, 'a.png');
    await writeFile(png, Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]));
    const head = await readHead(png);
    assert.equal(head.length, 16, 'only the first bytes are read');
    assert.ok(signatureMatches(head, 'png'));
    assert.ok(!signatureMatches(head, 'pdf'));
    const tiny = join(dir, 'b.pdf');
    await writeFile(tiny, '%P');
    assert.equal((await readHead(tiny)).length, 2);
    assert.ok(!signatureMatches(await readHead(tiny), 'pdf'), 'a truncated file does not pass');
    assert.ok(signatureMatches(Buffer.from('<html>'), 'txt'), 'types without a signature pass');
    assert.ok(hasSignature('jpeg') && hasSignature('webp') && !hasSignature('svg'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

