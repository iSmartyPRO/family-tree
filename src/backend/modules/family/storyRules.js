import { httpError } from '../shared/acl.js';
import { cleanDate, UNION_STATUSES } from './rules.js';

/*
 * Pure rules of tree stories, labels and a tree's own calendar (no database
 * here, covered by test/family-stories.test.js).
 *
 *   Labels   houses, branches, clans, sides: a colour and a name, held by people.
 *   Era      a tree that lives in its own calendar (a saga, a novel, a
 *            chronicle): a year suffix and the year that counts as «now».
 *   Stories  ordered chapters told over the tree. Each chapter can carry typed
 *            events — who appears, is born, dies, marries, changes side, which
 *            secret comes out — so the tree can be shown «as of» any chapter.
 */

export const LABEL_COLORS = ['red', 'orange', 'gold', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'gray', 'black'];
export const EVENT_TYPES = ['appear', 'birth', 'death', 'union', 'side', 'secret', 'moment'];
export const MAX_LABELS = 40;
export const MAX_EVENTS = 40;
export const MAX_EVENT_PERSONS = 40;
export const MAX_FOCUS = 12;

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const longText = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const LABEL_ID = /^[a-z0-9][a-z0-9_-]{0,23}$/;

/** Ids of people: positive integers, no repeats, at most `max`. */
export function cleanIds(value, max = MAX_EVENT_PERSONS) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const n = Number(item);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

/** The tree's labels: [{ id, name, color, group, emblem }], ids unique. */
export function cleanLabels(value) {
  if (!Array.isArray(value)) return [];
  const items = value.slice(0, MAX_LABELS).filter((raw) => raw && typeof raw === 'object' && text(raw.name, 40));
  // Labels keep their ids (people refer to them); new ones get a free «lN».
  const taken = new Set(items.map((raw) => String(raw.id || '').toLowerCase().trim()).filter((id) => LABEL_ID.test(id)));
  const out = [];
  const seen = new Set();
  let n = 0;
  for (const raw of items) {
    const name = text(raw.name, 40);
    let id = String(raw.id || '').toLowerCase().trim();
    if (!LABEL_ID.test(id) || seen.has(id)) {
      do n += 1;
      while (taken.has(`l${n}`) || seen.has(`l${n}`));
      id = `l${n}`;
    }
    seen.add(id);
    out.push({
      id,
      name,
      color: LABEL_COLORS.includes(raw.color) ? raw.color : 'gray',
      group: text(raw.group, 40),
      // An emoji or a short mark shown on the label chip.
      emblem: [...String(raw.emblem ?? '').trim()].slice(0, 2).join(''),
    });
  }
  return out;
}

/** A person's labels: ids that exist among the tree's labels (when given). */
export function cleanPersonLabels(value, labels = null) {
  if (!Array.isArray(value)) return [];
  const known = labels ? new Set(labels.map((l) => l.id)) : null;
  const out = [];
  for (const item of value.slice(0, 12)) {
    const id = String(item || '').toLowerCase().trim();
    if (LABEL_ID.test(id) && !out.includes(id) && (!known || known.has(id))) out.push(id);
  }
  return out;
}

/** A tree's own calendar: { era: 'AC', eraNow: '0133' } — both optional. */
export function cleanEra(input = {}, current = {}) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  return {
    era: text(pick('era', current.era), 16),
    eraNow: cleanDate(pick('eraNow', current.eraNow), 'present year'),
  };
}

export function cleanStory(input = {}, current = null) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const base = current || {};
  const story = {
    title: text(pick('title', base.title), 120),
    subtitle: text(pick('subtitle', base.subtitle), 200),
    description: longText(pick('description', base.description), 4000),
    color: LABEL_COLORS.includes(pick('color', base.color)) ? pick('color', base.color) : 'indigo',
    spoilers: pick('spoilers', base.spoilers ?? false) === true,
  };
  if (!story.title) throw httpError(400, 'Enter a title for the story', 'TITLE_REQUIRED');
  return story;
}

/**
 * One event of a chapter. `ctx` knows the tree: person ids, unions (id →
 * partners) and label ids; events that point at nothing are dropped.
 */
export function cleanEvent(raw, ctx = {}) {
  if (!raw || typeof raw !== 'object' || !EVENT_TYPES.includes(raw.type)) return null;
  const persons = cleanIds(raw.persons).filter((id) => !ctx.persons || ctx.persons.has(id));
  const event = { type: raw.type, persons };
  const note = text(raw.text, 300);
  if (raw.type === 'union') {
    const unionId = Number(raw.unionId);
    const union = ctx.unions ? ctx.unions.get(unionId) : { partners: persons };
    if (!Number.isInteger(unionId) || unionId <= 0 || !union) return null;
    event.unionId = unionId;
    event.persons = union.partners ? [...union.partners] : persons;
    if (UNION_STATUSES.includes(raw.status)) event.status = raw.status;
  } else if (raw.type === 'side') {
    const labelId = String(raw.labelId || '').toLowerCase();
    if (!LABEL_ID.test(labelId) || (ctx.labels && !ctx.labels.has(labelId))) return null;
    event.labelId = labelId;
    if (!event.persons.length) return null;
  } else if (raw.type === 'secret' || raw.type === 'moment') {
    if (!note && !event.persons.length) return null;
  } else if (!event.persons.length) {
    return null;
  }
  if (note) event.text = note;
  return event;
}

export function cleanChapter(input = {}, current = null, ctx = {}) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const base = current || {};
  const focusIds = cleanIds(pick('focus', base.focus), MAX_FOCUS).filter((id) => !ctx.persons || ctx.persons.has(id));
  const rawEvents = pick('events', base.events);
  const events = (Array.isArray(rawEvents) ? rawEvents : [])
    .slice(0, MAX_EVENTS)
    .map((e) => cleanEvent(e, ctx))
    .filter(Boolean);
  const chapter = {
    part: text(pick('part', base.part), 80),
    label: text(pick('label', base.label), 40),
    title: text(pick('title', base.title), 160),
    year: cleanDate(pick('year', base.year), 'chapter year'),
    when: text(pick('when', base.when), 80),
    teaser: text(pick('teaser', base.teaser), 400),
    body: longText(pick('body', base.body), 20000),
    focus: focusIds,
    events,
  };
  if (!chapter.title) throw httpError(400, 'Enter a title for the chapter', 'TITLE_REQUIRED');
  return chapter;
}

/** Remaps ids inside a chapter (import, clone); ids without a match drop out. */
export function remapChapter(chapter, personMap, unionMap) {
  const mapIds = (ids) => (Array.isArray(ids) ? ids.map((id) => personMap.get(String(id))).filter(Boolean) : []);
  return {
    ...chapter,
    focus: mapIds(chapter.focus),
    events: (Array.isArray(chapter.events) ? chapter.events : [])
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const out = { ...e, persons: mapIds(e.persons) };
        if (e.type === 'union') {
          const unionId = unionMap.get(String(e.unionId));
          if (!unionId) return null;
          out.unionId = unionId;
        }
        return out;
      })
      .filter(Boolean),
  };
}
