/*
 * Stories told over a tree (backend storyRules.js): ordered chapters whose
 * typed events say who appears, is born, dies, marries, changes side, or
 * which secret comes out. From them the tree can be shown «as of» any chapter:
 * the spoiler guard, the story player and each person's arc use the same
 * rules, so nothing a reader has not reached leaks through any view.
 */

export const EVENT_TYPES = ['appear', 'birth', 'death', 'union', 'side', 'lineage', 'secret', 'moment'];
export const EVENT_ICONS = { appear: '✦', birth: '✧', death: '✝', union: '⚭', side: '⚑', lineage: '⚘', secret: '❖', moment: '◆' };
// Couples still together at a point of the story: their end date is not known yet.
const ONGOING = ['married', 'partners', 'engaged'];

/** All people a chapter speaks about: its focus and the people of its events. */
export function chapterPeople(chapter) {
  const ids = new Set(chapter?.focus || []);
  for (const e of chapter?.events || []) for (const id of e.persons || []) ids.add(id);
  return ids;
}

/**
 * What the chapters of a story establish, chapter by chapter: when each person
 * is first mentioned, dies, each couple forms, and what a couple's state is.
 */
export function storyFacts(story) {
  const firstSeen = new Map();
  const diedAt = new Map();
  const unionAt = new Map();
  const unionStates = new Map(); // unionId → [[index, status]]
  const sides = []; // [index, personId, labelId]
  const lineageAt = new Map(); // child → chapter where their parents become known
  (story?.chapters || []).forEach((chapter, index) => {
    for (const id of chapterPeople(chapter)) if (!firstSeen.has(id)) firstSeen.set(id, index);
    for (const e of chapter.events || []) {
      if (e.type === 'death') for (const id of e.persons || []) if (!diedAt.has(id)) diedAt.set(id, index);
      if (e.type === 'union' && e.unionId) {
        if (!unionAt.has(e.unionId)) unionAt.set(e.unionId, index);
        if (e.status) unionStates.set(e.unionId, [...(unionStates.get(e.unionId) || []), [index, e.status]]);
      }
      if (e.type === 'side' && e.labelId) for (const id of e.persons || []) sides.push([index, id, e.labelId]);
      if (e.type === 'lineage') for (const id of e.persons || []) if (!lineageAt.has(id)) lineageAt.set(id, index);
    }
  });
  return { firstSeen, diedAt, unionAt, unionStates, sides, lineageAt };
}

/** The year a chapter lives in: its own, or the last one before it that has a year. */
export function chapterYear(story, index) {
  const chapters = story?.chapters || [];
  for (let i = Math.min(index, chapters.length - 1); i >= 0; i -= 1) if (chapters[i].year) return chapters[i].year;
  return null;
}

/** Labels a person holds after the side changes up to `upto` (all when null). */
function labelsAt(person, sides, upto, groupOf) {
  let labels = [...(person.labels || [])];
  for (const [index, id, labelId] of sides) {
    if (id !== person.id || (upto !== null && index > upto)) continue;
    const group = groupOf.get(labelId);
    // Joining a side leaves the other labels of its group.
    labels = labels.filter((l) => l !== labelId && (!group || groupOf.get(l) !== group));
    labels.push(labelId);
  }
  return labels;
}

/**
 * The tree as a reader at chapter `upto` (0-based) of `story` knows it.
 * `upto === null` — the whole story is known: only the side changes apply.
 * People never mentioned in the story are background and always shown.
 * Returns a data object of the same shape plus `now` (the chapter's year).
 */
export function treeAt(data, story, upto = null) {
  if (!data) return data;
  const labelsOfTree = data.tree?.labels || [];
  if (!story || !story.chapters?.length) return data;
  const facts = storyFacts(story);
  const groupOf = new Map(labelsOfTree.map((l) => [l.id, l.group || '']));
  const known = (index) => upto === null || index <= upto;
  const visible = new Set();
  const persons = [];
  for (const p of data.persons) {
    const seen = facts.firstSeen.get(p.id);
    if (seen !== undefined && !known(seen)) continue;
    visible.add(p.id);
    const next = { ...p, labels: labelsAt(p, facts.sides, upto, groupOf) };
    const died = facts.diedAt.get(p.id);
    if (died !== undefined && !known(died)) {
      next.isAlive = true;
      next.deathDate = null;
      next.deathPlace = '';
    }
    persons.push(next);
  }
  const unions = [];
  for (const u of data.unions) {
    if (!visible.has(u.partnerA) || !visible.has(u.partnerB)) continue;
    const formed = facts.unionAt.get(u.id);
    if (formed !== undefined && !known(formed)) continue;
    const states = (facts.unionStates.get(u.id) || []).filter(([index]) => known(index));
    if (!states.length || upto === null) {
      unions.push(u);
      continue;
    }
    const status = states[states.length - 1][1];
    unions.push({ ...u, status, endDate: ONGOING.includes(status) ? null : u.endDate });
  }
  return {
    ...data,
    persons,
    // A child whose parentage comes out later hangs free until then.
    parents: data.parents.filter((l) => {
      if (!visible.has(l.childId) || !visible.has(l.parentId)) return false;
      const told = facts.lineageAt.get(l.childId);
      return told === undefined || known(told);
    }),
    unions,
    now: upto === null ? undefined : chapterYear(story, upto),
    storyAt: upto,
  };
}

/** Chapters (up to `upto`) where a person appears, with what happens to them there. */
export function personArc(story, personId, upto = null) {
  const out = [];
  (story?.chapters || []).forEach((chapter, index) => {
    if (upto !== null && index > upto) return;
    const roles = [];
    if ((chapter.focus || []).includes(personId)) roles.push('focus');
    for (const e of chapter.events || []) if ((e.persons || []).includes(personId)) roles.push(e.type);
    if (roles.length) out.push({ chapter, index, roles: [...new Set(roles)] });
  });
  return out;
}

/** Secrets that came out up to `upto`, optionally about one person. */
export function secretsOf(story, personId = null, upto = null) {
  const out = [];
  (story?.chapters || []).forEach((chapter, index) => {
    if (upto !== null && index > upto) return;
    for (const e of chapter.events || []) {
      if (e.type !== 'secret') continue;
      if (personId !== null && !(e.persons || []).includes(personId)) continue;
      out.push({ ...e, chapter, index });
    }
  });
  return out;
}

/** Chapters grouped by their part («Season 1», «Book two»), keeping the order. */
export function chapterParts(story) {
  const parts = [];
  (story?.chapters || []).forEach((chapter, index) => {
    const last = parts[parts.length - 1];
    if (last && last.part === (chapter.part || '')) last.items.push({ chapter, index });
    else parts.push({ part: chapter.part || '', items: [{ chapter, index }] });
  });
  return parts;
}

/** A short name of a chapter for buttons and lists: «S1 · E3» or «3». */
export const chapterTag = (chapter, index) => chapter?.label || String(index + 1);

// ── Reading progress (per browser) ──────────────────────────────────────────

/**
 * Where a reader is in a story: { upto: number | null } — null shows
 * everything. Stored per tree (or per link) and per story in localStorage.
 */
const progressKey = (scope, storyId) => `family_story_${scope}_${storyId}`;

export function readProgress(scope, storyId) {
  try {
    const raw = localStorage.getItem(progressKey(scope, storyId));
    if (raw === null) return undefined;
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeProgress(scope, storyId, value) {
  try {
    localStorage.setItem(progressKey(scope, storyId), JSON.stringify(value));
  } catch {
    /* private mode: asked again next time */
  }
}
