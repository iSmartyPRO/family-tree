import { copyFile } from 'fs/promises';
import { query, withTransaction } from '../../config/database.js';
import { LEVEL, httpError, levelOn, requireLevel, writeAcl } from '../shared/acl.js';
import { extOf, newStorageKey, storagePath } from '../shared/storage.js';
import { buildIndex, cleanFilter, selectPeople, subGraph } from './selection.js';
import { loadGraph } from './service.js';
import { cleanTree } from './rules.js';

/*
 * «This is me», saved views (filters) of a tree, and cloning a tree or a view
 * into a new tree of one's own.
 */

const ACL = 'family_tree_acl';

async function requireTree(ctx, treeId, needed) {
  const exists = await query(`SELECT 1 FROM family_trees WHERE id = $1`, [treeId]);
  if (!exists.rowCount) throw httpError(404, 'Not found', 'NOT_FOUND');
  const level = await levelOn(ACL, treeId, ctx);
  requireLevel(level, needed);
  return level;
}

export const viewShape = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  filter: cleanFilter(row.filter || {}),
  updatedAt: row.updated_at,
});

// ── Me ──────────────────────────────────────────────────────────────────────

export async function meOf(ctx, treeId) {
  if (!ctx.userId) return null;
  const row = (await query(`SELECT person_id FROM family_me WHERE tree_id = $1 AND user_id = $2`, [treeId, ctx.userId])).rows[0];
  return row?.person_id || null;
}

export async function setMe(ctx, treeId, personId) {
  await requireTree(ctx, treeId, LEVEL.view);
  if (!personId) {
    await query(`DELETE FROM family_me WHERE tree_id = $1 AND user_id = $2`, [treeId, ctx.userId]);
    return null;
  }
  const person = (await query(`SELECT tree_id FROM family_persons WHERE id = $1`, [personId])).rows[0];
  if (!person || person.tree_id !== treeId) throw httpError(400, 'This person is not in the tree', 'WRONG_TREE');
  await query(
    `INSERT INTO family_me (tree_id, user_id, person_id) VALUES ($1, $2, $3)
     ON CONFLICT (tree_id, user_id) DO UPDATE SET person_id = EXCLUDED.person_id`,
    [treeId, ctx.userId, personId]
  );
  return personId;
}

// ── Views ───────────────────────────────────────────────────────────────────

export async function listViews(treeId) {
  const { rows } = await query(`SELECT * FROM family_views WHERE tree_id = $1 ORDER BY LOWER(name)`, [treeId]);
  return rows.map(viewShape);
}

async function cleanViewInput(treeId, input, current = null) {
  const name = String(input.name ?? current?.name ?? '').trim().slice(0, 120);
  if (!name) throw httpError(400, 'Enter a name for the view', 'NAME_REQUIRED');
  const filter = cleanFilter(input.filter ?? current?.filter ?? {});
  if (!filter.focus) throw httpError(400, 'Choose who the view is built around', 'FOCUS_REQUIRED');
  const person = (await query(`SELECT tree_id FROM family_persons WHERE id = $1`, [filter.focus])).rows[0];
  if (!person || person.tree_id !== treeId) throw httpError(400, 'This person is not in the tree', 'WRONG_TREE');
  return { name, description: String(input.description ?? current?.description ?? '').trim().slice(0, 2000), filter };
}

export async function createView(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const view = await cleanViewInput(treeId, input);
  const { rows } = await query(
    `INSERT INTO family_views (tree_id, name, description, filter, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [treeId, view.name, view.description, JSON.stringify(view.filter), ctx.userId]
  );
  return viewShape(rows[0]);
}

async function viewRow(id) {
  const row = (await query(`SELECT * FROM family_views WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

export async function updateView(ctx, id, input = {}) {
  const row = await viewRow(id);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  const view = await cleanViewInput(row.tree_id, input, { ...row, filter: row.filter });
  const { rows } = await query(
    `UPDATE family_views SET name = $2, description = $3, filter = $4, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, view.name, view.description, JSON.stringify(view.filter)]
  );
  return viewShape(rows[0]);
}

export async function deleteView(ctx, id) {
  const row = await viewRow(id);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  await query(`DELETE FROM family_views WHERE id = $1`, [id]);
}

/** Ids a filter shows in a tree (a person id or 'me' as the focus). */
export async function selectIds(ctx, treeId, filter) {
  await requireTree(ctx, treeId, LEVEL.view);
  const graph = await loadGraph(treeId);
  const focus = filter?.focus === 'me' ? await meOf(ctx, treeId) : filter?.focus;
  const { ids, filter: clean } = selectPeople(buildIndex(graph.persons, graph.parents, graph.unions), { ...filter, focus });
  return { ids: [...ids], filter: clean };
}

/** The people of a view (or of the whole tree when `viewId` is empty). */
export async function graphOfView(treeId, viewId, photoBase) {
  const graph = await loadGraph(treeId, photoBase);
  if (!viewId) return { graph, view: null };
  const view = (await query(`SELECT * FROM family_views WHERE id = $1 AND tree_id = $2`, [viewId, treeId])).rows[0];
  if (!view) throw httpError(404, 'This view no longer exists', 'NOT_FOUND');
  const { ids } = selectPeople(buildIndex(graph.persons, graph.parents, graph.unions), view.filter);
  return { graph: subGraph(graph, ids), view: viewShape(view) };
}

// ── Clone ───────────────────────────────────────────────────────────────────

/**
 * Copies people, links and photos into a new tree owned by `ctx.userId`.
 * `graph` is what may be copied (a whole tree or one view).
 */
export async function cloneGraph(ctx, sourceTreeId, graph, input = {}) {
  const tree = cleanTree({ name: input.name, description: input.description || '' });
  const sources = (
    await query(`SELECT * FROM family_persons WHERE tree_id = $1 AND id = ANY($2::int[])`, [sourceTreeId, graph.persons.map((p) => p.id)])
  ).rows;
  // Photos are copied as files first: the new tree must not share blobs.
  const photos = new Map();
  const fullPhotos = new Map();
  for (const row of sources) {
    if (!row.photo_key) continue;
    try {
      const key = await newStorageKey(row.photo_ext || extOf(row.photo_key), 'family');
      await copyFile(storagePath(row.photo_key), storagePath(key));
      photos.set(row.id, key);
      if (row.photo_full_key) {
        const full = await newStorageKey(extOf(row.photo_full_key) || 'jpg', 'family');
        await copyFile(storagePath(row.photo_full_key), storagePath(full));
        fullPhotos.set(row.id, full);
      }
    } catch {
      /* a missing file just leaves the copy without a photo */
    }
  }
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO family_trees (name, description, created_by, updated_by) VALUES ($1, $2, $3, $3) RETURNING id`,
      [tree.name, tree.description, ctx.userId]
    );
    const newTree = rows[0].id;
    await writeAcl(client, ACL, newTree, [{ subjectType: 'user', subjectId: ctx.userId, level: 'manage' }], null);
    const idMap = new Map();
    for (const p of sources) {
      const res = await client.query(
        `INSERT INTO family_persons (tree_id, first_name, last_name, patronymic, maiden_name, gender, birth_date, birth_place, is_alive,
           death_date, death_place, occupation, bio, contacts, photo_key, photo_ext, photo_version, legacy_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,$18,$18) RETURNING id`,
        [
          newTree,
          p.first_name,
          p.last_name,
          p.patronymic,
          p.maiden_name,
          p.gender,
          p.birth_date,
          p.birth_place,
          p.is_alive,
          p.death_date,
          p.death_place,
          p.occupation,
          p.bio,
          JSON.stringify(input.keepContacts ? p.contacts || {} : {}),
          photos.get(p.id) || null,
          photos.has(p.id) ? p.photo_ext : null,
          `clone:${p.id}`,
          ctx.userId,
        ]
      );
      idMap.set(p.id, res.rows[0].id);
      if (fullPhotos.has(p.id)) await client.query(`UPDATE family_persons SET photo_full_key = $2 WHERE id = $1`, [res.rows[0].id, fullPhotos.get(p.id)]);
    }
    // Manual family orders, in the copy's ids (partners left out of the copy drop out).
    for (const p of sources) {
      const order = Array.isArray(p.family_order) ? p.family_order : [];
      if (!order.length) continue;
      const mapped = order.map((v) => (v === 0 ? 0 : idMap.get(v))).filter((v) => v !== undefined);
      await client.query(`UPDATE family_persons SET family_order = $2 WHERE id = $1`, [idMap.get(p.id), JSON.stringify(mapped)]);
    }
    for (const l of graph.parents) {
      if (!idMap.has(l.childId) || !idMap.has(l.parentId)) continue;
      await client.query(`INSERT INTO family_parents (tree_id, child_id, parent_id, kind) VALUES ($1,$2,$3,$4)`, [
        newTree,
        idMap.get(l.childId),
        idMap.get(l.parentId),
        l.kind || 'birth',
      ]);
    }
    for (const u of graph.unions) {
      if (!idMap.has(u.partnerA) || !idMap.has(u.partnerB)) continue;
      await client.query(
        `INSERT INTO family_unions (tree_id, partner_a, partner_b, status, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6)`,
        [newTree, idMap.get(u.partnerA), idMap.get(u.partnerB), u.status, u.startDate, u.endDate]
      );
    }
    if (input.meId && idMap.has(Number(input.meId))) {
      await client.query(`INSERT INTO family_me (tree_id, user_id, person_id) VALUES ($1,$2,$3)`, [newTree, ctx.userId, idMap.get(Number(input.meId))]);
    }
    return { id: newTree, persons: idMap.size };
  });
}

/** Clone from one's own tree: the whole tree or a saved view. */
export async function cloneTree(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.view);
  const { graph } = await graphOfView(treeId, Number(input.viewId) || null);
  return cloneGraph(ctx, treeId, graph, { ...input, keepContacts: true, meId: await meOf(ctx, treeId) });
}
