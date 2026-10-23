import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMime, domainAllowed } from '../services/google.js';
import { seal, unseal } from '../services/crypto.js';
import { normalizeDomains } from '../services/settings.js';
import { buildManifest, faviconUrl } from '../routes/pwa.routes.js';

test('Gmail MIME message encodes UTF-8 subject and parts', () => {
  const mime = buildMime({ from: 'it@example.com', fromName: 'Портал', to: 'u@example.com', subject: 'Задача GEN-1', text: 'Привет', html: '<b>Привет</b>' });
  assert.match(mime, /^From: =\?UTF-8\?B\?/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.match(mime, /multipart\/alternative/);
  assert.ok(mime.includes(Buffer.from('Привет').toString('base64')));
});

test('sealed secrets open only with the same key and resist tampering', () => {
  const sealed = seal('refresh-token-123');
  assert.notEqual(sealed, 'refresh-token-123');
  assert.equal(unseal(sealed), 'refresh-token-123');
  const parts = sealed.split('.');
  parts[3] = Buffer.from('forged').toString('base64url');
  assert.equal(unseal(parts.join('.')), null);
  assert.equal(unseal(''), '');
});

test('Google domain allow-list uses hd or email domain', () => {
  assert.equal(normalizeDomains(' Corp.KZ, @example.com bad;x.org'), 'corp.kz,example.com,x.org');
  assert.ok(domainAllowed({ email: 'a@corp.kz', email_verified: true }, ['corp.kz']));
  // A consumer Google account with an unverified company address does not pass the allow-list.
  assert.ok(!domainAllowed({ email: 'a@corp.kz', email_verified: false }, ['corp.kz']));
  assert.ok(!domainAllowed({ email: 'a@corp.kz' }, ['corp.kz']));
  assert.ok(domainAllowed({ email: 'a@gmail.com', hd: 'corp.kz' }, ['corp.kz']));
  assert.ok(!domainAllowed({ email: 'a@gmail.com' }, ['corp.kz']));
  assert.ok(domainAllowed({ email: 'a@gmail.com' }, []));
});

test('PWA manifest follows settings and enabled modules', () => {
  const parsed = {
    appName: 'Example Company Portal',
    appDescription: 'Portal',
    appearance: { customColors: {} },
    modules: { dashboard: { enabled: true }, kb: { enabled: true } },
  };
  const manifest = buildManifest(parsed, 'ru');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.short_name, 'Example');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  assert.deepEqual(manifest.shortcuts.map((item) => item.url), ['/app/dashboard', '/app/kb']);
  const custom = buildManifest({ ...parsed, appearance: { appIconUrl: '/uploads/logos/logo-x.png' } });
  assert.ok(custom.icons.every((icon) => icon.src === '/uploads/logos/logo-x.png'));
  const svg = buildManifest({ ...parsed, appearance: { appIconUrl: '/uploads/logos/logo-y.svg' } });
  assert.deepEqual(svg.icons, [{ src: '/uploads/logos/logo-y.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]);
});

test('tab icon follows the app icon setting, default otherwise', () => {
  assert.equal(faviconUrl({ appearance: { appIconUrl: '/uploads/logos/logo-x.png' } }), '/uploads/logos/logo-x.png');
  assert.equal(faviconUrl({ appearance: { appIconUrl: null } }), '/favicon.svg');
  assert.equal(faviconUrl({}), '/favicon.svg');
});

test('push subscriptions only reach real push services', async () => {
  const { isPushEndpoint } = await import('../services/push.js');
  assert.ok(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'));
  assert.ok(isPushEndpoint('https://web.push.apple.com/QAbc'));
  assert.ok(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x'));
  assert.ok(!isPushEndpoint('https://10.0.0.5/api'), 'no private hosts');
  assert.ok(!isPushEndpoint('https://fcm.googleapis.com:8443/x'), 'no custom ports');
  assert.ok(!isPushEndpoint('https://fcm.googleapis.com.evil.io/x'));
  assert.ok(!isPushEndpoint('http://fcm.googleapis.com/x'));
});

