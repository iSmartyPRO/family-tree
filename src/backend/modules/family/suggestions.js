import { query } from '../../config/database.js';
import { requestAs } from '../../api/events.js';
import { LEVEL, contextFromRequest, httpError, levelOn, requireLevel } from '../shared/acl.js';
import { extOf, removeBlob, sendBlob, storagePath } from '../shared/storage.js';
import { cleanPerson } from './rules.js';
import { createPerson, personShape, receivePhotos, updatePerson } from './service.js';
import { graphOfView } from './views.js';

/*
 * Changes proposed through a public link. A link with access «suggest» stores
 * them for review; «edit» applies them at once (as the link's author) and
 * keeps the record, so owners see who changed what.
 *
 *   kind 'update'   payload: person fields            person_id: who
 *   kind 'photo'    photo_key: the new picture         person_id: who
 *   kind 'relative' payload: { person, relation }      person_id: the anchor
 */

const ACL = 'family_tree_acl';
const KINDS = ['update', 'photo', 'relative'];
const RELATIONS = ['parent', 'child', 'partner', 'sibling'];

const shape = (row, person = null) => ({
  id: row.id,
  kind: row.kind,
  status: row.status,
  personId: row.person_id,
  person: person ? { id: person.id, firstName: person.first_name, lastName: person.last_name, patronymic: person.patronymic, gender: person.gender, photoUrl: person.photo_key ? `/api/app/family/persons/${person.id}/photo?v=${person.photo_version}` : null } : null,
  payload: row.payload || {},
  photoUrl: row.photo_key ? `/api/app/family/suggestions/${row.id}/photo` : null,
  authorName: row.author_name,
  authorPhone: row.author_phone || '',
  note: row.author_note,
  via: row.share_title || null,
  resultPersonId: row.result_person_id,
  createdAt: row.created_at,
  reviewedAt: row.reviewed_at,
});

/**
 * The people a link may touch: those of its view (or the whole tree).
 * Cached for a few seconds: a tree page asks for every photo at once.
 */
const visibleCache = new Map();
export async function visibleIds(share) {
  const key = `${share.id}:${share.tree_id}:${share.view_id || 0}`;
  const hit = visibleCache.get(key);
  if (hit && hit.until > Date.now()) return hit.ids;
  const { graph } = await graphOfView(share.tree_id, share.view_id);
  const ids = new Set(graph.persons.map((p) => p.id));
  if (visibleCache.size > 500) visibleCache.clear();
  visibleCache.set(key, { ids, until: Date.now() + 15000 });
  return ids;
}

// Unreviewed proposals a single link may pile up (photos take disk space).
const MAX_PENDING_PER_LINK = 300;
async function checkPendingCap(share) {
  const n = (await query(`SELECT COUNT(*)::int AS n FROM family_suggestions WHERE share_id = $1 AND status = 'pending'`, [share.id])).rows[0].n;
  if (n >= MAX_PENDING_PER_LINK) throw httpError(429, 'Too many proposals are waiting for review on this link', 'TOO_MANY_PENDING');
}

async function authorContext(share) {
  const author = share.created_by ? await requestAs(share.created_by) : null;
  if (!author) throw httpError(410, 'This link is no longer available', 'OWNER_INACTIVE');
  return contextFromRequest(author, 'family.admin');
}

/** Who sent it: the introduced visitor of the link, else the name typed with the change. */
function cleanAuthor(input = {}, visitor = null) {
  const name = String(visitor?.name || input.authorName || '').trim().slice(0, 120);
  if (!name) throw httpError(400, 'Introduce yourself so the owner knows who suggested it', 'AUTHOR_REQUIRED');
  return { name, phone: String(visitor?.phone || input.authorPhone || '').trim().slice(0, 40), note: String(input.note || '').trim().slice(0, 2000) };
}

/** The payload of a suggestion, cleaned the same way as a direct edit. */
async function cleanPayload(share, kind, input, ids) {
  const personId = Number(input.personId) || null;
  if (!personId || !ids.has(personId)) throw httpError(404, 'This person is not in the shared tree', 'NOT_FOUND');
  if (kind === 'update') {
    const current = (await query(`SELECT * FROM family_persons WHERE id = $1`, [personId])).rows[0];
    // Only what was sent is proposed; contacts are not shown to visitors, so they cannot be changed.
    const { contacts, ...data } = input.data || {};
    const next = cleanPerson(data, personShape(current));
    const changes = {};
    for (const key of Object.keys(data)) if (key in next && JSON.stringify(next[key]) !== JSON.stringify(personShape(current)[key])) changes[key] = next[key];
    if (!Object.keys(changes).length) throw httpError(400, 'Nothing has changed', 'NO_CHANGES');
    return { personId, payload: changes };
  }
  if (kind === 'relative') {
    const type = input.relation?.type;
    if (!RELATIONS.includes(type)) throw httpError(400, 'Unknown relation', 'BAD_RELATION');
    const person = cleanPerson({ ...(input.data || {}), contacts: {} });
    const parentName = String(input.relation?.parentName || '').trim().slice(0, 80);
    return { personId, payload: { person, relation: { type, personId, ...(type === 'sibling' && parentName ? { parentName } : {}) } } };
  }
  throw httpError(400, 'Unknown suggestion', 'BAD_KIND');
}

async function record(share, kind, personId, payload, author, extra = {}) {
  const { rows } = await query(
    `INSERT INTO family_suggestions (tree_id, share_id, person_id, kind, payload, photo_key, photo_ext, author_name, author_note, status, result_person_id, reviewed_at, author_phone, photo_full_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      share.tree_id,
      share.id,
      personId,
      kind,
      JSON.stringify(payload || {}),
      extra.photoKey || null,
      extra.photoExt || null,
      author.name,
      author.note,
      extra.status || 'pending',
      extra.resultPersonId || null,
      extra.status === 'applied' ? new Date() : null,
      author.phone || '',
      extra.photoFullKey || null,
    ]
  );
  return rows[0];
}

async function applyRow(ctx, row) {
  if (row.kind === 'update') {
    await updatePerson(ctx, row.person_id, row.payload);
    return row.person_id;
  }
  if (row.kind === 'relative') {
    const person = await createPerson(ctx, row.tree_id, { ...row.payload.person, relation: row.payload.relation });
    return person.id;
  }
  if (row.kind === 'photo') {
    // The suggestion's file becomes the person's photo; the old one is removed.
    const old = (await query(`SELECT photo_key, photo_full_key FROM family_persons WHERE id = $1`, [row.person_id])).rows[0];
    await query(
      `UPDATE family_persons SET photo_key = $2, photo_ext = $3, photo_full_key = $4, photo_version = photo_version + 1, updated_at = NOW() WHERE id = $1`,
      [row.person_id, row.photo_key, row.photo_ext, row.photo_full_key || null]
    );
    await query(`UPDATE family_suggestions SET photo_key = NULL, photo_full_key = NULL WHERE id = $1`, [row.id]);
    if (old?.photo_key && old.photo_key !== row.photo_key) await removeBlob(old.photo_key);
    if (old?.photo_full_key && old.photo_full_key !== row.photo_full_key) await removeBlob(old.photo_full_key);
    return row.person_id;
  }
  throw httpError(400, 'Unknown suggestion', 'BAD_KIND');
}

/** Fields worth naming in the log: for a new relative only those actually filled in. */
function changedFields(payload) {
  if (!payload.person) return Object.keys(payload);
  const p = payload.person;
  return Object.keys(p).filter((k) => {
    const v = p[k];
    if (k === 'firstName' || k === 'lastName' || k === 'familyOrder' || k === 'contacts') return false;
    if (k === 'gender') return v && v !== 'unknown';
    if (k === 'isAlive') return v === false;
    return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);
  });
}

// ── Public side ─────────────────────────────────────────────────────────────

export async function suggest(share, input = {}, visitor = null) {
  if (!['suggest', 'edit'].includes(share.access)) throw httpError(403, 'This link is view-only', 'VIEW_ONLY');
  const kind = KINDS.includes(input.kind) && input.kind !== 'photo' ? input.kind : null;
  if (!kind) throw httpError(400, 'Unknown suggestion', 'BAD_KIND');
  const author = cleanAuthor(input, visitor);
  if (share.access === 'suggest') await checkPendingCap(share);
  const ids = await visibleIds(share);
  const { personId, payload } = await cleanPayload(share, kind, input, ids);
  if (share.access === 'edit') {
    const ctx = await authorContext(share);
    const row = await record(share, kind, personId, payload, author, { status: 'applied' });
    let resultPersonId;
    try {
      resultPersonId = await applyRow(ctx, row);
    } catch (err) {
      await query(`DELETE FROM family_suggestions WHERE id = $1`, [row.id]);
      throw err;
    }
    await query(`UPDATE family_suggestions SET result_person_id = $2 WHERE id = $1`, [row.id, resultPersonId]);
    return { applied: true, personId: resultPersonId, kind, anchorId: personId, author, changed: changedFields(payload) };
  }
  await record(share, kind, personId, payload, author);
  return { applied: false, kind, anchorId: personId, author, changed: changedFields(payload) };
}

export async function suggestPhoto(share, personId, req, res, visitor = null) {
  if (!['suggest', 'edit'].includes(share.access)) throw httpError(403, 'This link is view-only', 'VIEW_ONLY');
  const ids = await visibleIds(share);
  if (!ids.has(personId)) throw httpError(404, 'This person is not in the shared tree', 'NOT_FOUND');
  if (share.access === 'suggest') await checkPendingCap(share);
  const got = await receivePhotos(req, res);
  let author;
  try {
    author = cleanAuthor(req.body || {}, visitor);
  } catch (err) {
    await got.drop();
    throw err;
  }
  const extra = { photoKey: got.key, photoExt: got.ext, photoFullKey: got.fullKey };
  if (share.access === 'edit') {
    const ctx = await authorContext(share);
    const row = await record(share, 'photo', personId, {}, author, { ...extra, status: 'applied' });
    try {
      await applyRow(ctx, row);
    } catch (err) {
      await query(`DELETE FROM family_suggestions WHERE id = $1`, [row.id]);
      await got.drop();
      throw err;
    }
    return { applied: true, author };
  }
  await record(share, 'photo', personId, {}, author, extra);
  return { applied: false, author };
}

// ── Owners ──────────────────────────────────────────────────────────────────

export async function listSuggestions(ctx, treeId, status = 'pending') {
  const level = await levelOn(ACL, treeId, ctx);
  requireLevel(level, LEVEL.edit);
  const states = status === 'all' ? ['pending', 'accepted', 'rejected', 'applied'] : status === 'done' ? ['accepted', 'rejected', 'applied'] : ['pending'];
  const { rows } = await query(
    `SELECT s.*, sh.title AS share_title FROM family_suggestions s LEFT JOIN family_shares sh ON sh.id = s.share_id
     WHERE s.tree_id = $1 AND s.status = ANY($2::text[]) ORDER BY s.created_at DESC LIMIT 200`,
    [treeId, states]
  );
  const ids = [...new Set(rows.map((r) => r.person_id).filter(Boolean))];
  const persons = ids.length ? (await query(`SELECT * FROM family_persons WHERE id = ANY($1::int[])`, [ids])).rows : [];
  const byId = new Map(persons.map((p) => [p.id, p]));
  const pending = (await query(`SELECT COUNT(*)::int AS n FROM family_suggestions WHERE tree_id = $1 AND status = 'pending'`, [treeId])).rows[0].n;
  // Visitors' phones are for managers only, as in the activity log.
  const phones = level >= LEVEL.manage;
  return { suggestions: rows.map((r) => ({ ...shape(r, byId.get(r.person_id)), authorPhone: phones ? r.author_phone || '' : '' })), pending };
}

async function suggestionRow(id) {
  const row = (await query(`SELECT * FROM family_suggestions WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

export async function reviewSuggestion(ctx, id, accept) {
  const row = await suggestionRow(id);
  requireLevel(await levelOn(ACL, row.tree_id, ctx), LEVEL.edit);
  // Claim the suggestion first: a double click or two owners must not apply it twice.
  const claimed = await query(
    `UPDATE family_suggestions SET reviewed_by = $2, reviewed_at = NOW() WHERE id = $1 AND status = 'pending' AND reviewed_at IS NULL RETURNING id`,
    [id, ctx.userId]
  );
  if (!claimed.rowCount) throw httpError(409, 'This suggestion is already reviewed', 'REVIEWED');
  let resultPersonId = null;
  if (accept) {
    try {
      resultPersonId = await applyRow(ctx, row);
    } catch (err) {
      await query(`UPDATE family_suggestions SET reviewed_by = NULL, reviewed_at = NULL WHERE id = $1 AND status = 'pending'`, [id]);
      throw err;
    }
  } else if (row.photo_key) {
    await removeBlob(row.photo_key);
    await removeBlob(row.photo_full_key);
  }
  await query(
    `UPDATE family_suggestions SET status = $2::text, reviewed_by = $3, reviewed_at = NOW(), result_person_id = $4, photo_key = CASE WHEN $2::text = 'rejected' THEN NULL ELSE photo_key END, photo_full_key = CASE WHEN $2::text = 'rejected' THEN NULL ELSE photo_full_key END WHERE id = $1`,
    [id, accept ? 'accepted' : 'rejected', ctx.userId, resultPersonId]
  );
  return { resultPersonId, treeId: row.tree_id, kind: row.kind, personId: row.person_id, authorName: row.author_name };
}

export async function sendSuggestionPhoto(ctx, id, res) {
  const row = await suggestionRow(id);
  requireLevel(await levelOn(ACL, row.tree_id, ctx), LEVEL.edit);
  // An accepted photo moved to the person; show theirs then.
  const key = row.photo_key || (row.kind === 'photo' && row.status !== 'rejected' ? (await query(`SELECT photo_key FROM family_persons WHERE id = $1`, [row.person_id])).rows[0]?.photo_key : null);
  if (!key) throw httpError(404, 'No photo', 'NOT_FOUND');
  await sendBlob(res, storagePath(key), { name: 'photo.jpg', ext: extOf(key) || 'jpg' });
}
