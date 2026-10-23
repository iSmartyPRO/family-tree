import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_CATALOG } from '../modules/catalog.js';
import {
  checkParentLink,
  checkUnion,
  cleanDate,
  cleanPerson,
  cleanUnion,
  compareDates,
  isAncestor,
  parentsMap,
} from '../modules/family/rules.js';

const family = MODULE_CATALOG.find((module) => module.id === 'family');

test('family catalog: defaults and sanitize clamp values', () => {
  assert.ok(family.permissions.includes('family.admin'));
  const next = family.sanitize(family.defaults, { maxPhotoMb: 999, publicLinks: false, maxShareDays: -5, extra: 1 });
  assert.equal(next.maxPhotoMb, 50);
  assert.equal(next.publicLinks, false);
  assert.equal(next.maxShareDays, 0);
  assert.equal(next.extra, undefined);
});

test('cleanDate accepts partial dates and rejects the rest', () => {
  assert.equal(cleanDate(''), null);
  assert.equal(cleanDate('1950'), '1950');
  assert.equal(cleanDate('1950-03'), '1950-03');
  assert.equal(cleanDate('2000-02-29'), '2000-02-29');
  for (const bad of ['1950-13', '1900-02-29', '03.08.1950', 'abc', '0000']) {
    assert.throws(() => cleanDate(bad), (err) => err.code === 'INVALID_DATE', bad);
  }
});

test('compareDates compares on the shared precision', () => {
  assert.equal(compareDates('1950', '1950-05-01'), 0);
  assert.equal(compareDates('1949-12', '1950'), -1);
  assert.equal(compareDates(null, '1950'), null);
});

test('cleanPerson: name required, living people have no death, death after birth', () => {
  assert.throws(() => cleanPerson({}), (err) => err.code === 'NAME_REQUIRED');
  const alive = cleanPerson({ firstName: '  Ann  ', deathDate: '2000', isAlive: true, gender: 'robot' });
  assert.equal(alive.firstName, 'Ann');
  assert.equal(alive.deathDate, null);
  assert.equal(alive.gender, 'unknown');
  assert.throws(
    () => cleanPerson({ firstName: 'A', isAlive: false, birthDate: '1950', deathDate: '1940' }),
    (err) => err.code === 'DEATH_BEFORE_BIRTH'
  );
  const contacts = cleanPerson({ firstName: 'A', contacts: { phone: ' +1 ', evil: 'x' } }).contacts;
  assert.deepEqual(contacts, { phone: '+1' });
});

test('cleanPerson keeps stored fields that are not sent', () => {
  const current = { firstName: 'Ann', lastName: 'Lee', gender: 'female', birthDate: '1950', isAlive: true, contacts: { phone: '1' } };
  const next = cleanPerson({ lastName: 'Smith' }, current);
  assert.equal(next.firstName, 'Ann');
  assert.equal(next.lastName, 'Smith');
  assert.equal(next.birthDate, '1950');
  assert.deepEqual(next.contacts, { phone: '1' });
});

test('parent links: no self links, duplicates, third parents or cycles', () => {
  const links = [
    { childId: 2, parentId: 1 },
    { childId: 3, parentId: 2 },
  ];
  assert.throws(() => checkParentLink(links, 5, 5), (err) => err.code === 'SELF_LINK');
  assert.throws(() => checkParentLink(links, 2, 1), (err) => err.code === 'DUPLICATE');
  assert.throws(() => checkParentLink(links, 1, 3), (err) => err.code === 'CYCLE');
  checkParentLink(links, 2, 9);
  assert.throws(
    () => checkParentLink([...links, { childId: 2, parentId: 9 }], 2, 10),
    (err) => err.code === 'TOO_MANY_PARENTS'
  );
  assert.equal(isAncestor(parentsMap(links), 3, 1), true);
  assert.equal(isAncestor(parentsMap(links), 1, 3), false);
});

test('unions: two different people, once, not ancestor and descendant', () => {
  const links = [{ childId: 2, parentId: 1 }];
  const unions = [{ partnerA: 4, partnerB: 5 }];
  assert.throws(() => checkUnion(links, unions, 4, 4), (err) => err.code === 'SELF_LINK');
  assert.throws(() => checkUnion(links, unions, 5, 4), (err) => err.code === 'DUPLICATE');
  assert.throws(() => checkUnion(links, unions, 1, 2), (err) => err.code === 'ANCESTOR_UNION');
  checkUnion(links, unions, 1, 4);
});

test('cleanUnion: known statuses and ordered dates', () => {
  assert.equal(cleanUnion({ status: 'weird' }).status, 'married');
  assert.equal(cleanUnion({ status: 'divorced' }).status, 'divorced');
  assert.throws(() => cleanUnion({ startDate: '2000', endDate: '1999' }), (err) => err.code === 'END_BEFORE_START');
});

// ── Views (selection.js) ────────────────────────────────────────────────────

import { buildIndex, selectPeople, subGraph, parentOnSide } from '../modules/family/selection.js';

/*
 *   gpF(1)═gmF(2)        gpM(3)═gmM(4)
 *        │                    │
 *   uncle(5)  dad(6)════════mom(7)   aunt(8)
 *     │            │                   │
 *  cousin(9)     me(10)═wife(11)     cousinM(12)
 *                  │
 *               kid(13)
 */
const P = (id, gender) => ({ id, gender });
const persons = [P(1, 'male'), P(2, 'female'), P(3, 'male'), P(4, 'female'), P(5, 'male'), P(6, 'male'), P(7, 'female'), P(8, 'female'), P(9, 'male'), P(10, 'male'), P(11, 'female'), P(12, 'female'), P(13, 'male')];
const links = [
  [5, 1], [5, 2], [6, 1], [6, 2], [7, 3], [7, 4], [8, 3], [8, 4], [9, 5], [10, 6], [10, 7], [12, 8], [13, 10], [13, 11],
].map(([childId, parentId]) => ({ childId, parentId }));
const unions = [
  { partnerA: 1, partnerB: 2 }, { partnerA: 3, partnerB: 4 }, { partnerA: 6, partnerB: 7 }, { partnerA: 10, partnerB: 11 },
];
const index = buildIndex(persons, links, unions);
const pick = (filter) => [...selectPeople(index, { focus: 10, ...filter }).ids].sort((a, b) => a - b);

test('views: whole family around me', () => {
  assert.deepEqual(pick({ collateral: 2 }), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

test("views: father's side keeps mother as a co-parent, not her family", () => {
  assert.deepEqual(parentOnSide(index, 10, 'father'), [6]);
  assert.deepEqual(pick({ side: 'father', collateral: 2 }), [1, 2, 5, 6, 7, 9, 10, 11, 13]);
  assert.deepEqual(pick({ side: 'father', collateral: 2, partners: false }), [1, 2, 5, 6, 9, 10, 13]);
});

test("views: mother's side, only direct line", () => {
  assert.deepEqual(pick({ side: 'mother', collateral: 0, descendants: 0, partners: false }), [3, 4, 7, 10]);
});

test('views: depth limits and subgraph keeps only inner links', () => {
  assert.deepEqual(pick({ ancestors: 1, descendants: 0, collateral: 1, partners: false }), [6, 7, 10]);
  const ids = new Set([6, 7, 10]);
  const sub = subGraph({ persons, parents: links, unions }, ids);
  assert.equal(sub.persons.length, 3);
  assert.equal(sub.parents.length, 2);
  assert.equal(sub.unions.length, 1);
});

import { cleanFamilyOrder } from '../modules/family/rules.js';

test('family order: partner ids and 0 for unknown, no repeats or junk', () => {
  assert.deepEqual(cleanFamilyOrder([5, '0', 5, -1, 'x', 7]), [5, 0, 7]);
  assert.deepEqual(cleanFamilyOrder('nope'), []);
  const kept = cleanPerson({ lastName: 'A' }, { firstName: 'B', familyOrder: [3, 0] });
  assert.deepEqual(kept.familyOrder, [3, 0]);
});
