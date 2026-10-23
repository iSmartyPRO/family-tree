import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, cleanLimits, cleanRules, decide, effectivePolicy, limitsByTable, normalizePath, ruleMatches } from '../api/scopes.js';
import { cleanEvents, eventMatches } from '../api/events.js';

const policy = (scopes, rules = []) => effectivePolicy({ scopes }, { rules });

test('api paths: /api/v1 and /api normalise to the same path', () => {
  assert.equal(normalizePath('/api/v1/app/kb/kb?x=1'), '/app/kb/kb');
  assert.equal(normalizePath('/api/app/kb/kb/'), '/app/kb/kb');
});

test('api areas: modules, account, administration, blocked and free paths', () => {
  assert.deepEqual(classify('/app/kb/kb'), { area: 'kb' });
  assert.deepEqual(classify('/auth/me'), { area: 'account' });
  assert.deepEqual(classify('/admin/groups/3'), { area: 'admin.users' });
  assert.deepEqual(classify('/admin/security/events'), { area: 'admin.security' });
  assert.deepEqual(classify('/admin/settings'), { area: 'admin.settings' });
  assert.deepEqual(classify('/auth/login'), { blocked: true });
  assert.deepEqual(classify('/account/password'), { blocked: true });
  assert.deepEqual(classify('/account/api/tokens'), { blocked: true });
  assert.deepEqual(classify('/admin/api/tokens'), { blocked: true });
  // A token must not link its owner's sign-in identities or end sessions (it could sign in as the owner).
  for (const path of ['/admin/users/5/telegram', '/admin/users/5/directory', '/admin/users/5/directory/password', '/admin/users/5/google', '/admin/users/5/sessions/abc']) {
    assert.deepEqual(classify(path), { blocked: true }, path);
  }
  assert.deepEqual(classify('/admin/users/5'), { area: 'admin.users' });
  assert.deepEqual(classify('/apps'), { free: true });
});

test('api levels: read allows GET only, write allows everything', () => {
  const p = policy({ kb: 'read', files: 'write' });
  assert.equal(decide(p, 'GET', '/app/kb/kb').ok, true);
  assert.equal(decide(p, 'POST', '/app/kb/kb').scope, 'kb:write');
  assert.equal(decide(p, 'DELETE', '/app/files/messages/4').ok, true);
  assert.equal(decide(p, 'GET', '/app/dashboard/events').ok, false);
});

test('api rules: deny wins, allow opens, blocked stays blocked', () => {
  const p = policy({ kb: 'write', files: 'read' }, [
    { effect: 'deny', methods: ['DELETE'], path: '/app/kb/**' },
    { effect: 'allow', methods: ['POST'], path: '/app/files/rooms/*/messages' },
    { effect: 'allow', methods: [], path: '/account/password' },
  ]);
  assert.equal(decide(p, 'DELETE', '/app/kb/kb/WEB-1').ok, false);
  assert.equal(decide(p, 'PUT', '/app/kb/kb/WEB-1').ok, true);
  assert.equal(decide(p, 'POST', '/app/files/rooms/12/messages').ok, true);
  assert.equal(decide(p, 'POST', '/app/files/rooms/12/members').ok, false);
  assert.equal(decide(p, 'PUT', '/account/password').code, 'ROUTE_NOT_AVAILABLE');
});

test('api rules: patterns and cleaning', () => {
  assert.equal(ruleMatches({ methods: [], path: '/app/kb/**' }, 'GET', '/app/kb'), true);
  assert.equal(ruleMatches({ methods: [], path: '/app/kb/*' }, 'GET', '/app/kb/a/b'), false);
  assert.equal(ruleMatches({ methods: [], path: '/app/kb/kb/:ref' }, 'GET', '/app/kb/kb/WEB-1'), true);
  const rules = cleanRules([{ effect: 'allow', path: '/api/v1/app/x', methods: ['get', 'BOGUS'] }, { effect: 'maybe', path: '/x' }, { effect: 'deny', path: 'bad path!' }]);
  assert.deepEqual(rules, [{ effect: 'allow', methods: ['GET'], path: '/app/x', note: '' }]);
});

test('api templates: token changes overlay the template', () => {
  const p = effectivePolicy({ scopes: { kb: 'read', files: 'write' }, rules: [] }, { scopes: { kb: 'write', bogus: 'write' } });
  assert.equal(p.scopes.kb, 'write');
  assert.equal(p.scopes.files, 'write');
  assert.equal(p.scopes.bogus, undefined);
  assert.equal(p.scopes.dashboard, 'none');
});

test('api limits: ids per kind, keyed by access-list table', () => {
  const limits = cleanLimits({ 'files.spaces': ['3', 3, -1, 'x'], unknown: [1] });
  assert.deepEqual(limits, { 'files.spaces': [3] });
  assert.deepEqual([...limitsByTable(limits).fs_space_acl], [3]);
  assert.equal(limitsByTable({}), null);
});

test('api events: groups and wildcards', () => {
  assert.equal(eventMatches(['user.*'], 'user.created'), true);
  assert.equal(eventMatches(['user.*'], 'kb.item'), false);
  assert.equal(eventMatches(['*'], 'user.deleted'), true);
  assert.deepEqual(cleanEvents(['user.created', 'user.*', 'nope', 'zzz.*']), ['user.created', 'user.*']);
});

test('api paths: letter case and doubled slashes cannot dodge the gate', () => {
  const p = effectivePolicy({ scopes: { kb: 'read' } }, { rules: [{ effect: 'deny', methods: [], path: '/app/kb/projects/**' }] });
  assert.equal(decide(p, 'POST', normalizePath('/api/Account/API/tokens')).code, 'ROUTE_NOT_AVAILABLE');
  assert.equal(decide(p, 'GET', normalizePath('/api/v1/Admin/Users')).ok, false);
  assert.equal(decide(p, 'PUT', normalizePath('/api/ACCOUNT/password')).code, 'ROUTE_NOT_AVAILABLE');
  assert.equal(decide(p, 'GET', normalizePath('/api/App/Kb/Projects/WEB')).ok, false);
  assert.equal(decide(p, 'GET', normalizePath('/api//app//kb/projects/web')).ok, false);
  assert.equal(decide(p, 'GET', normalizePath('/api/App/Kb/Kb/WEB-1')).ok, true);
});
