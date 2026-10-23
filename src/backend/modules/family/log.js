import { query } from '../../config/database.js';
import { LEVEL, httpError, levelOn, requireLevel } from '../shared/acl.js';

/*
 * Activity log of a tree: who did what and when. Entries are written after an
 * action succeeds; a failing log write never breaks the action itself.
 */

const ACL = 'family_tree_acl';
const text = (v, max) => String(v ?? '').slice(0, max);

/** Name of a person as it was at the moment of the action (the person may be deleted later). */
export async function personLabel(personId) {
  if (!personId) return '';
  const row = (await query(`SELECT first_name, last_name, patronymic FROM family_persons WHERE id = $1`, [personId])).rows[0];
  return row ? [row.last_name, row.first_name, row.patronymic].filter(Boolean).join(' ') : '';
}

/**
 * Writes one entry. `who` is { userId } for signed-in people or
 * { shareId, visitor: { name, phone } } for link visitors.
 */
export async function logEvent(req, treeId, action, { who = {}, personId = null, personName = null, details = {} } = {}) {
  try {
    if (!treeId) return;
    const name = personName ?? (personId ? await personLabel(personId) : '');
    await query(
      `INSERT INTO family_log (tree_id, share_id, user_id, visitor_name, visitor_phone, action, person_id, person_name, details, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        treeId,
        who.shareId || null,
        who.userId || null,
        text(who.visitor?.name, 120),
        text(who.visitor?.phone, 40),
        text(action, 40),
        personId || null,
        text(name, 250),
        JSON.stringify(details || {}),
        text(req?.ip, 64),
        text(req?.get?.('user-agent'), 300),
      ]
    );
  } catch (err) {
    console.error('family log:', err.message);
  }
}

export async function treeOf(table, id) {
  const allowed = ['family_persons', 'family_parents', 'family_unions', 'family_shares', 'family_views', 'family_suggestions'];
  if (!allowed.includes(table)) return null;
  const row = (await query(`SELECT tree_id FROM ${table} WHERE id = $1`, [id])).rows[0];
  return row?.tree_id || null;
}

export async function listLog(ctx, treeId, filter = {}) {
  requireLevel(await levelOn(ACL, treeId, ctx), LEVEL.manage);
  const where = ['l.tree_id = $1'];
  const params = [treeId];
  if (filter.who === 'visitors') where.push('l.share_id IS NOT NULL AND l.user_id IS NULL');
  if (filter.who === 'members') where.push('l.user_id IS NOT NULL');
  const intOrBad = (value) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1) throw httpError(400, 'Bad cursor', 'BAD_CURSOR');
    return n;
  };
  if (filter.shareId) {
    params.push(intOrBad(filter.shareId));
    where.push(`l.share_id = $${params.length}`);
  }
  if (filter.before) {
    params.push(intOrBad(filter.before));
    where.push(`l.id < $${params.length}`);
  }
  const limit = Math.min(200, Math.max(10, Number(filter.limit) || 100));
  const { rows } = await query(
    `SELECT l.*, COALESCE(u.display_name, u.username) AS user_name, s.title AS share_title, v.name AS view_name
     FROM family_log l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN family_shares s ON s.id = l.share_id
     LEFT JOIN family_views v ON v.id = s.view_id
     WHERE ${where.join(' AND ')}
     ORDER BY l.id DESC LIMIT ${limit}`,
    params
  );
  return {
    entries: rows.map((r) => ({
      id: Number(r.id),
      action: r.action,
      at: r.created_at,
      user: r.user_id ? { id: r.user_id, name: r.user_name } : null,
      visitor: r.share_id && !r.user_id ? { name: r.visitor_name, phone: r.visitor_phone } : null,
      share: r.share_id ? { id: r.share_id, title: r.share_title || r.view_name || '' } : null,
      personId: r.person_id,
      personName: r.person_name,
      details: r.details || {},
      ip: r.ip,
      userAgent: r.user_agent,
    })),
    more: rows.length === limit,
  };
}
