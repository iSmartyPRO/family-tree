import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_PASSWORD_MIN, addressKey } from '../modules/shared/linkPasswords.js';

test('link passwords: IPv6 clients share one budget per /64, IPv4 stays per address', () => {
  assert.equal(addressKey('203.0.113.7'), '203.0.113.7');
  assert.equal(addressKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(addressKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(addressKey('2001:db8:1:2::5'), '2001:db8:1:2::/64');
  // Hosts of one /64 cannot spread guesses over many keys.
  assert.equal(addressKey('2001:db8:1:2::1'), addressKey('2001:db8:1:2:ffff::9'));
  assert.notEqual(addressKey('2001:db8:1:2::1'), addressKey('2001:db8:1:3::1'));
  assert.equal(addressKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(addressKey('::1'), '0:0:0:0::/64');
});

test('link passwords: new passwords need at least 8 characters', () => {
  assert.equal(LINK_PASSWORD_MIN, 8);
});
