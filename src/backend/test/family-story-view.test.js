import test from 'node:test';
import assert from 'node:assert/strict';

// The tree «as of» a chapter is computed in the browser (frontend modules/family/story.js).
const story = await import('../../frontend/src/modules/family/story.js');

/*
 * A small saga: grandparents (background, never mentioned), their son Ben who
 * marries Cleo in chapter 2, their child Dan born in chapter 3, a foundling Eve
 * who appears in chapter 1 but whose parent (Ben) comes out only in chapter 3,
 * and Ben dying in chapter 3. Ben joins the «north» side in chapter 2.
 */
const data = {
  tree: { labels: [{ id: 'north', group: 'Side' }, { id: 'south', group: 'Side' }, { id: 'house', group: 'House' }] },
  persons: [
    { id: 1, firstName: 'Ann', isAlive: false, labels: [] },
    { id: 2, firstName: 'Ben', isAlive: false, deathDate: '1950', labels: ['house', 'south'] },
    { id: 3, firstName: 'Cleo', isAlive: true, labels: [] },
    { id: 4, firstName: 'Dan', isAlive: true, labels: [] },
    { id: 5, firstName: 'Eve', isAlive: true, labels: [] },
  ],
  parents: [
    { childId: 2, parentId: 1 },
    { childId: 4, parentId: 2 },
    { childId: 4, parentId: 3 },
    { childId: 5, parentId: 2 },
  ],
  unions: [{ id: 9, partnerA: 2, partnerB: 3, status: 'widowed', startDate: '1940', endDate: '1950' }],
};
const saga = {
  chapters: [
    { year: '1938', focus: [2], events: [{ type: 'appear', persons: [2, 5] }] },
    { year: '1940', focus: [], events: [{ type: 'union', unionId: 9, persons: [2, 3], status: 'married' }, { type: 'side', persons: [2], labelId: 'north' }] },
    { year: null, focus: [4], events: [{ type: 'birth', persons: [4] }, { type: 'death', persons: [2] }, { type: 'lineage', persons: [5] }] },
  ],
};
const ids = (d) => d.persons.map((p) => p.id).sort();
const byId = (d, id) => d.persons.find((p) => p.id === id);

test('family story view: later people stay hidden, background people always show', () => {
  const at0 = story.treeAt(data, saga, 0);
  assert.deepEqual(ids(at0), [1, 2, 5]);
  assert.deepEqual(at0.unions, []);
  assert.deepEqual(ids(story.treeAt(data, saga, 1)), [1, 2, 3, 5]);
  assert.deepEqual(ids(story.treeAt(data, saga, 2)), [1, 2, 3, 4, 5]);
});

test('family story view: deaths happen in their chapter, not before', () => {
  const before = byId(story.treeAt(data, saga, 1), 2);
  assert.equal(before.isAlive, true);
  assert.equal(before.deathDate, null);
  const after = byId(story.treeAt(data, saga, 2), 2);
  assert.equal(after.isAlive, false);
  assert.equal(after.deathDate, '1950');
});

test('family story view: couples form at their event and show its state', () => {
  const at1 = story.treeAt(data, saga, 1);
  assert.equal(at1.unions.length, 1);
  assert.equal(at1.unions[0].status, 'married');
  // An ongoing union does not know its end yet.
  assert.equal(at1.unions[0].endDate, null);
  // With the whole story known, the stored state stands.
  assert.equal(story.treeAt(data, saga, null).unions[0].status, 'widowed');
});

test('family story view: parent links wait for the chapter that reveals them', () => {
  const linked = (d, child, parent) => d.parents.some((l) => l.childId === child && l.parentId === parent);
  assert.equal(linked(story.treeAt(data, saga, 0), 5, 2), false);
  assert.equal(linked(story.treeAt(data, saga, 0), 2, 1), true);
  assert.equal(linked(story.treeAt(data, saga, 2), 5, 2), true);
});

test('family story view: taking a side leaves the other label of its group only', () => {
  assert.deepEqual(byId(story.treeAt(data, saga, 0), 2).labels, ['house', 'south']);
  assert.deepEqual(byId(story.treeAt(data, saga, 1), 2).labels, ['house', 'north']);
  assert.deepEqual(byId(story.treeAt(data, saga, null), 2).labels, ['house', 'north']);
});

test('family story view: «now» is the chapter year, or the last known before it', () => {
  assert.equal(story.treeAt(data, saga, 0).now, '1938');
  assert.equal(story.treeAt(data, saga, 2).now, '1940');
  assert.equal(story.treeAt(data, saga, null).now, undefined);
});

test('family story view: a person’s arc and secrets stop at the reader’s place', () => {
  const arc = story.personArc(saga, 2, 1).map((a) => [a.index, a.roles]);
  assert.deepEqual(arc, [
    [0, ['focus', 'appear']],
    [1, ['union', 'side']],
  ]);
  assert.equal(story.personArc(saga, 2, null).length, 3);
  assert.deepEqual(
    story.chapterParts({ chapters: [{ part: 'A' }, { part: 'A' }, { part: 'B' }] }).map((p) => [p.part, p.items.length]),
    [
      ['A', 2],
      ['B', 1],
    ]
  );
});
