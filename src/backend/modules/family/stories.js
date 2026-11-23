import { query, withTransaction } from '../../config/database.js';
import { LEVEL, httpError, levelOn, requireLevel } from '../shared/acl.js';
import { cleanChapter, cleanStory, remapChapter } from './storyRules.js';

/*
 * Stories of a tree: ordered chapters told over the family, each with typed
 * events (storyRules.js). The whole set comes with the tree in one answer —
 * the player, the spoiler guard and every person's «in the story» list are
 * computed in the browser from it (frontend modules/family/story.js).
 */

const ACL = 'family_tree_acl';

async function requireTree(ctx, treeId, needed) {
  const exists = await query(`SELECT 1 FROM family_trees WHERE id = $1`, [treeId]);
  if (!exists.rowCount) throw httpError(404, 'Not found', 'NOT_FOUND');
  requireLevel(await levelOn(ACL, treeId, ctx), needed);
}

const storyShape = (row) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  color: row.color,
  spoilers: row.spoilers,
  position: row.position,
  updatedAt: row.updated_at,
  chapters: [],
});

const chapterShape = (row) => ({
  id: row.id,
  storyId: row.story_id,
  position: row.position,
  part: row.part,
  label: row.label,
  title: row.title,
  year: row.year,
  when: row.when,
  teaser: row.teaser,
  body: row.body,
  focus: Array.isArray(row.focus) ? row.focus : [],
  events: Array.isArray(row.events) ? row.events : [],
});

/** What a chapter may point at: the tree's people, couples and labels. */
async function treeContext(run, treeId) {
  const [persons, unions, tree] = await Promise.all([
    run(`SELECT id FROM family_persons WHERE tree_id = $1`, [treeId]),
    run(`SELECT id, partner_a, partner_b FROM family_unions WHERE tree_id = $1`, [treeId]),
    run(`SELECT labels FROM family_trees WHERE id = $1`, [treeId]),
  ]);
  return {
    persons: new Set(persons.rows.map((r) => r.id)),
    unions: new Map(unions.rows.map((r) => [r.id, { partners: [r.partner_a, r.partner_b] }])),
    labels: new Set((Array.isArray(tree.rows[0]?.labels) ? tree.rows[0].labels : []).map((l) => l.id)),
  };
}

/**
 * Stories of a tree with their chapters. `onlyPersons` (a Set) keeps only
 * these people in chapters — for links that show a part of the tree.
 */
export async function listStories(treeId, { onlyPersons = null } = {}) {
  const [stories, chapters, persons] = await Promise.all([
    query(`SELECT * FROM family_stories WHERE tree_id = $1 ORDER BY position, id`, [treeId]),
    query(`SELECT * FROM family_chapters WHERE tree_id = $1 ORDER BY position, id`, [treeId]),
    query(`SELECT id FROM family_persons WHERE tree_id = $1`, [treeId]),
  ]);
  // People deleted after a chapter was written drop out of it.
  const alive = onlyPersons || new Set(persons.rows.map((r) => r.id));
  const keep = (ids) => ids.filter((id) => alive.has(id));
  const byId = new Map(stories.rows.map((row) => [row.id, storyShape(row)]));
  for (const row of chapters.rows) {
    const story = byId.get(row.story_id);
    if (!story) continue;
    const chapter = chapterShape(row);
    chapter.focus = keep(chapter.focus);
    chapter.events = chapter.events.map((e) => ({ ...e, persons: keep(e.persons || []) })).filter((e) => e.persons.length || e.text);
    story.chapters.push(chapter);
  }
  return [...byId.values()];
}

// ── Stories ────────────────────────────────────────────────────────────────

async function storyRow(id) {
  const row = (await query(`SELECT * FROM family_stories WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

async function touch(run, treeId, userId) {
  await run(`UPDATE family_trees SET updated_at = NOW(), updated_by = $2 WHERE id = $1`, [treeId, userId]);
}

export async function createStory(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const story = cleanStory(input);
  const { rows } = await query(
    `INSERT INTO family_stories (tree_id, title, subtitle, description, color, spoilers, position, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(position), -1) + 1 FROM family_stories WHERE tree_id = $1),$7,$7) RETURNING *`,
    [treeId, story.title, story.subtitle, story.description, story.color, story.spoilers, ctx.userId]
  );
  await touch(query, treeId, ctx.userId);
  return storyShape(rows[0]);
}

export async function updateStory(ctx, storyId, input = {}) {
  const row = await storyRow(storyId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  const story = cleanStory(input, row);
  const { rows } = await query(
    `UPDATE family_stories SET title = $2, subtitle = $3, description = $4, color = $5, spoilers = $6, updated_by = $7, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [storyId, story.title, story.subtitle, story.description, story.color, story.spoilers, ctx.userId]
  );
  await touch(query, row.tree_id, ctx.userId);
  return { ...storyShape(rows[0]), treeId: row.tree_id };
}

export async function deleteStory(ctx, storyId) {
  const row = await storyRow(storyId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  await query(`DELETE FROM family_stories WHERE id = $1`, [storyId]);
  await touch(query, row.tree_id, ctx.userId);
  return { treeId: row.tree_id, title: row.title };
}

// ── Chapters ───────────────────────────────────────────────────────────────

async function chapterRow(id) {
  const row = (await query(`SELECT * FROM family_chapters WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

/** A new chapter goes after `afterId` (or to the end). */
export async function createChapter(ctx, storyId, input = {}) {
  const story = await storyRow(storyId);
  await requireTree(ctx, story.tree_id, LEVEL.edit);
  const chapter = cleanChapter(input, null, await treeContext(query, story.tree_id));
  return withTransaction(async (client) => {
    await client.query(`SELECT id FROM family_stories WHERE id = $1 FOR UPDATE`, [storyId]);
    let position;
    const after = Number(input.afterId) ? (await client.query(`SELECT position FROM family_chapters WHERE id = $1 AND story_id = $2`, [Number(input.afterId), storyId])).rows[0] : null;
    if (after) {
      position = after.position + 1;
      await client.query(`UPDATE family_chapters SET position = position + 1 WHERE story_id = $1 AND position >= $2`, [storyId, position]);
    } else {
      position = (await client.query(`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM family_chapters WHERE story_id = $1`, [storyId])).rows[0].n;
    }
    const { rows } = await client.query(
      `INSERT INTO family_chapters (story_id, tree_id, position, part, label, title, year, "when", teaser, body, focus, events)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [storyId, story.tree_id, position, chapter.part, chapter.label, chapter.title, chapter.year, chapter.when, chapter.teaser, chapter.body, JSON.stringify(chapter.focus), JSON.stringify(chapter.events)]
    );
    await client.query(`UPDATE family_stories SET updated_at = NOW(), updated_by = $2 WHERE id = $1`, [storyId, ctx.userId]);
    await touch(client.query.bind(client), story.tree_id, ctx.userId);
    return { ...chapterShape(rows[0]), treeId: story.tree_id };
  });
}

export async function updateChapter(ctx, chapterId, input = {}) {
  const row = await chapterRow(chapterId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  const chapter = cleanChapter(input, chapterShape(row), await treeContext(query, row.tree_id));
  const { rows } = await query(
    `UPDATE family_chapters SET part = $2, label = $3, title = $4, year = $5, "when" = $6, teaser = $7, body = $8, focus = $9, events = $10, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [chapterId, chapter.part, chapter.label, chapter.title, chapter.year, chapter.when, chapter.teaser, chapter.body, JSON.stringify(chapter.focus), JSON.stringify(chapter.events)]
  );
  await touch(query, row.tree_id, ctx.userId);
  return { ...chapterShape(rows[0]), treeId: row.tree_id };
}

export async function deleteChapter(ctx, chapterId) {
  const row = await chapterRow(chapterId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  await query(`DELETE FROM family_chapters WHERE id = $1`, [chapterId]);
  await touch(query, row.tree_id, ctx.userId);
  return { treeId: row.tree_id, title: row.title };
}

/** New order of a story's chapters: all of its chapter ids, in order. */
export async function orderChapters(ctx, storyId, ids) {
  const story = await storyRow(storyId);
  await requireTree(ctx, story.tree_id, LEVEL.edit);
  const list = Array.isArray(ids) ? ids.map(Number) : [];
  await withTransaction(async (client) => {
    const current = (await client.query(`SELECT id FROM family_chapters WHERE story_id = $1 FOR UPDATE`, [storyId])).rows.map((r) => r.id);
    if (list.length !== current.length || new Set(list).size !== list.length || !list.every((id) => current.includes(id))) {
      throw httpError(400, 'Send every chapter of the story once', 'BAD_ORDER');
    }
    for (const [position, id] of list.entries()) await client.query(`UPDATE family_chapters SET position = $2 WHERE id = $1`, [id, position]);
    await touch(client.query.bind(client), story.tree_id, ctx.userId);
  });
  return { treeId: story.tree_id };
}

/** New order of a tree's stories. */
export async function orderStories(ctx, treeId, ids) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const list = Array.isArray(ids) ? ids.map(Number) : [];
  await withTransaction(async (client) => {
    const current = (await client.query(`SELECT id FROM family_stories WHERE tree_id = $1 FOR UPDATE`, [treeId])).rows.map((r) => r.id);
    if (list.length !== current.length || new Set(list).size !== list.length || !list.every((id) => current.includes(id))) {
      throw httpError(400, 'Send every story of the tree once', 'BAD_ORDER');
    }
    for (const [position, id] of list.entries()) await client.query(`UPDATE family_stories SET position = $2 WHERE id = $1`, [id, position]);
  });
}

// ── Export, import, copies ─────────────────────────────────────────────────

/** Stories for a file: no database ids of their own, people and couples by their ids in the file. */
export function exportStories(stories) {
  return stories.map(({ id, position, updatedAt, chapters, ...story }) => ({
    ...story,
    chapters: chapters.map(({ id: _id, storyId, position: _p, ...chapter }) => chapter),
  }));
}

/**
 * Writes stories into a tree inside a transaction. `idMap` / `unionMap`: ids in
 * the source (as strings) → new ids. Chapters that do not pass the rules are
 * skipped, not the whole import.
 */
export async function importStories(client, treeId, stories, { idMap, unionMap, labels = [], userId = null }) {
  if (!Array.isArray(stories) || !stories.length) return 0;
  const run = client.query.bind(client);
  const ctx = await treeContext(run, treeId);
  ctx.labels = new Set((labels || []).map((l) => l.id));
  let start = (await run(`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM family_stories WHERE tree_id = $1`, [treeId])).rows[0].n;
  let count = 0;
  for (const raw of stories.slice(0, 50)) {
    let story;
    try {
      story = cleanStory(raw || {});
    } catch {
      continue;
    }
    const { rows } = await run(
      `INSERT INTO family_stories (tree_id, title, subtitle, description, color, spoilers, position, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
      [treeId, story.title, story.subtitle, story.description, story.color, story.spoilers, start, userId]
    );
    start += 1;
    count += 1;
    const chapters = Array.isArray(raw.chapters) ? raw.chapters.slice(0, 500) : [];
    let position = 0;
    for (const rawChapter of chapters) {
      let chapter;
      try {
        chapter = cleanChapter(remapChapter(rawChapter || {}, idMap, unionMap), null, ctx);
      } catch {
        continue;
      }
      await run(
        `INSERT INTO family_chapters (story_id, tree_id, position, part, label, title, year, "when", teaser, body, focus, events)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [rows[0].id, treeId, position, chapter.part, chapter.label, chapter.title, chapter.year, chapter.when, chapter.teaser, chapter.body, JSON.stringify(chapter.focus), JSON.stringify(chapter.events)]
      );
      position += 1;
    }
  }
  return count;
}
