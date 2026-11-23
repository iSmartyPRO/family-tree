import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanChapter,
  cleanEra,
  cleanEvent,
  cleanIds,
  cleanLabels,
  cleanPersonLabels,
  cleanStory,
  remapChapter,
} from '../modules/family/storyRules.js';

const ctx = {
  persons: new Set([1, 2, 3, 4]),
  unions: new Map([[10, { partners: [1, 2] }]]),
  labels: new Set(['black', 'green']),
};

test('family stories: ids are positive, unique and capped', () => {
  assert.deepEqual(cleanIds([3, '3', 2, -1, 'x', 0, 2.5, 7]), [3, 2, 7]);
  assert.deepEqual(cleanIds('nope'), []);
  assert.equal(cleanIds(Array.from({ length: 100 }, (_, i) => i + 1), 5).length, 5);
});

test('family stories: labels get valid ids, colours and short emblems', () => {
  const labels = cleanLabels([
    { id: 'North', name: ' The North Side ', color: 'black', group: 'Side', emblem: '🌲🔥🔥' },
    { id: 'north', name: 'Duplicate id', color: 'nope' },
    { name: '' },
    'junk',
  ]);
  assert.equal(labels.length, 2);
  assert.deepEqual(labels[0], { id: 'north', name: 'The North Side', color: 'black', group: 'Side', emblem: '🌲🔥' });
  assert.notEqual(labels[1].id, 'north');
  assert.equal(labels[1].color, 'gray');
  assert.deepEqual(cleanPersonLabels(['black', 'BLACK', 'ghost', 'green'], [{ id: 'black' }, { id: 'green' }]), ['black', 'green']);
  assert.deepEqual(cleanPersonLabels(['a', 'b']), ['a', 'b']);
});

test('family stories: a tree calendar keeps a suffix and a partial «now»', () => {
  assert.deepEqual(cleanEra({ era: '  AE ', eraNow: '0133' }), { era: 'AE', eraNow: '0133' });
  assert.deepEqual(cleanEra({}, { era: 'AE', eraNow: '0120' }), { era: 'AE', eraNow: '0120' });
  assert.deepEqual(cleanEra({ eraNow: '' }, { era: 'AE', eraNow: '0120' }), { era: 'AE', eraNow: null });
  assert.throws(() => cleanEra({ eraNow: '133 AE' }), { code: 'INVALID_DATE' });
});

test('family stories: a story needs a title; colour and spoilers are checked', () => {
  assert.throws(() => cleanStory({ title: '  ' }), { code: 'TITLE_REQUIRED' });
  const story = cleanStory({ title: 'Moving north', color: 'fuchsia', spoilers: 'yes' });
  assert.equal(story.color, 'indigo');
  assert.equal(story.spoilers, false);
  assert.equal(cleanStory({ spoilers: true }, { title: 'Kept', spoilers: false }).title, 'Kept');
  assert.equal(cleanStory({ spoilers: true }, { title: 'Kept' }).spoilers, true);
});

test('family stories: events point at people, couples and labels of the tree', () => {
  assert.equal(cleanEvent({ type: 'explode', persons: [1] }, ctx), null);
  assert.deepEqual(cleanEvent({ type: 'death', persons: [1, 99], text: ' in a storm ' }, ctx), { type: 'death', persons: [1], text: 'in a storm' });
  assert.equal(cleanEvent({ type: 'death', persons: [99] }, ctx), null);
  // A union event takes its people from the couple and may carry a status.
  assert.deepEqual(cleanEvent({ type: 'union', unionId: 10, persons: [3], status: 'married' }, ctx), {
    type: 'union',
    persons: [1, 2],
    unionId: 10,
    status: 'married',
  });
  assert.equal(cleanEvent({ type: 'union', unionId: 11 }, ctx), null);
  assert.deepEqual(cleanEvent({ type: 'side', persons: [3], labelId: 'GREEN' }, ctx), { type: 'side', persons: [3], labelId: 'green' });
  assert.equal(cleanEvent({ type: 'side', persons: [3], labelId: 'red' }, ctx), null);
  assert.equal(cleanEvent({ type: 'side', persons: [], labelId: 'green' }, ctx), null);
  // A secret or a moment may be told without people.
  assert.deepEqual(cleanEvent({ type: 'moment', text: 'A comet in the sky' }, ctx), { type: 'moment', persons: [], text: 'A comet in the sky' });
  assert.equal(cleanEvent({ type: 'secret' }, ctx), null);
});

test('family stories: chapters need a title, keep known people, partial years', () => {
  assert.throws(() => cleanChapter({ title: '' }, null, ctx), { code: 'TITLE_REQUIRED' });
  assert.throws(() => cleanChapter({ title: 'x', year: '101 AE' }, null, ctx), { code: 'INVALID_DATE' });
  const chapter = cleanChapter(
    {
      title: ' The First Winter ',
      label: 'S1 · E1',
      part: 'Part one',
      year: '1941',
      when: 'Winter 1941',
      focus: [1, 2, 99],
      events: [{ type: 'appear', persons: [1, 2] }, { type: 'bogus' }, { type: 'death', persons: [4] }],
      body: 'Line one\r\nLine two',
    },
    null,
    ctx
  );
  assert.equal(chapter.title, 'The First Winter');
  assert.deepEqual(chapter.focus, [1, 2]);
  assert.equal(chapter.events.length, 2);
  assert.equal(chapter.body, 'Line one\nLine two');
  // Fields not sent keep their value.
  const edited = cleanChapter({ teaser: 'The family leaves the village.' }, chapter, ctx);
  assert.equal(edited.title, 'The First Winter');
  assert.equal(edited.year, '1941');
  assert.equal(edited.teaser, 'The family leaves the village.');
});

test('family stories: remapping a chapter follows the new ids and drops the rest', () => {
  const people = new Map([
    ['a', 11],
    ['b', 12],
  ]);
  const unions = new Map([['u1', 50]]);
  const out = remapChapter(
    {
      title: 'x',
      focus: ['a', 'zz'],
      events: [
        { type: 'union', unionId: 'u1', persons: ['a', 'b'] },
        { type: 'union', unionId: 'u9', persons: ['a'] },
        { type: 'death', persons: ['b', 'c'] },
      ],
    },
    people,
    unions
  );
  assert.deepEqual(out.focus, [11]);
  assert.deepEqual(out.events, [
    { type: 'union', unionId: 50, persons: [11, 12] },
    { type: 'death', persons: [12] },
  ]);
});

test('family stories: new labels never take the id of a later existing one', () => {
  const labels = cleanLabels([{ name: 'New' }, { id: 'l1', name: 'Old one' }, { id: 'l2', name: 'Old two' }]);
  assert.deepEqual(labels.map((l) => l.id), ['l3', 'l1', 'l2']);
});
