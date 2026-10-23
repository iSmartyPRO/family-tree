import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../config/app.js';
import { query } from '../../config/database.js';
import { requestAs } from '../../api/events.js';
import { LEVEL, contextFromRequest, httpError, levelOn, requireLevel } from '../shared/acl.js';
import { LINK_PASSWORD_MIN } from '../shared/linkPasswords.js';
import { familySettings } from './service.js';
import { graphOfView } from './views.js';

/*
 * Public links to a tree or one of its views: /t/<token>. A random token (not
 * guessable), an optional password (bcrypt) and expiry, and what visitors may
 * do: look (view), propose changes for review (suggest) or edit the people of
 * the view directly (edit). Changing the password or revoking bumps `version`,
 * which invalidates the visitors' unlock tokens.
 */

const ACL = 'family_tree_acl';
export const ACCESS = ['view', 'suggest', 'edit'];
export const PHONE = ['off', 'optional', 'required'];
export const THEMES = ['system', 'light', 'dark'];

function shareShape(row) {
  return {
    id: row.id,
    token: row.token,
    url: `/t/${row.token}`,
    title: row.title || '',
    viewId: row.view_id || null,
    viewName: row.view_name || null,
    access: ACCESS.includes(row.access) ? row.access : 'view',
    allowClone: row.allow_clone !== false,
    askName: Boolean(row.ask_name),
    askPhone: PHONE.includes(row.ask_phone) ? row.ask_phone : 'off',
    theme: THEMES.includes(row.theme) ? row.theme : 'system',
    themeLocked: Boolean(row.theme_locked),
    assistant: Boolean(row.assistant),
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    createdAt: row.created_at,
  };
}

async function shareRow(id) {
  const row = (await query(`SELECT * FROM family_shares WHERE id = $1 AND revoked_at IS NULL`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

async function cleanShareInput(treeId, input, current = null) {
  const settings = await familySettings();
  if (!settings.publicLinks) throw httpError(403, 'Public links are turned off', 'LINKS_DISABLED');
  const out = { title: String(input.title ?? current?.title ?? '').trim().slice(0, 120) };
  const viewId = input.viewId === undefined ? current?.view_id || null : Number(input.viewId) || null;
  if (viewId) {
    const view = await query(`SELECT 1 FROM family_views WHERE id = $1 AND tree_id = $2`, [viewId, treeId]);
    if (!view.rowCount) throw httpError(400, 'This view is not in the tree', 'WRONG_VIEW');
  }
  out.viewId = viewId;
  const access = input.access === undefined ? current?.access || 'view' : input.access;
  out.access = ACCESS.includes(access) ? access : 'view';
  out.allowClone = input.allowClone === undefined ? current?.allow_clone !== false : input.allowClone !== false;
  out.askName = input.askName === undefined ? Boolean(current?.ask_name) : input.askName === true;
  const phone = input.askPhone === undefined ? current?.ask_phone || 'off' : input.askPhone;
  out.askPhone = PHONE.includes(phone) ? phone : 'off';
  // Asking for a phone asks for the name too — worked out when read (identityRule),
  // so turning the phone off later gives back the owner's own name setting.
  const theme = input.theme === undefined ? current?.theme || 'system' : input.theme;
  out.theme = THEMES.includes(theme) ? theme : 'system';
  out.themeLocked = input.themeLocked === undefined ? Boolean(current?.theme_locked) : input.themeLocked === true;
  if (out.theme === 'system') out.themeLocked = false;
  out.assistant = input.assistant === undefined ? Boolean(current?.assistant) : input.assistant === true;
  if (input.password !== undefined) {
    const password = String(input.password || '');
    if (password && password.length < LINK_PASSWORD_MIN) {
      throw httpError(400, `The password must be at least ${LINK_PASSWORD_MIN} characters`, 'WEAK_PASSWORD');
    }
    out.passwordHash = password ? await bcrypt.hash(password, 10) : null;
  } else {
    out.passwordHash = current ? current.password_hash : null;
  }
  if (settings.requireSharePassword && !out.passwordHash) throw httpError(400, 'A password is required for links', 'PASSWORD_REQUIRED');
  let expires = input.expiresAt === undefined ? current?.expires_at || null : input.expiresAt || null;
  if (expires) {
    expires = new Date(expires);
    if (Number.isNaN(expires.getTime())) throw httpError(400, 'Invalid expiry date', 'INVALID_DATE');
  }
  if (settings.maxShareDays) {
    const limit = new Date(Date.now() + settings.maxShareDays * 86400000);
    if (!expires || expires > limit) expires = limit;
  }
  out.expiresAt = expires;
  return out;
}

export async function listShares(ctx, treeId) {
  requireLevel(await levelOn(ACL, treeId, ctx), LEVEL.manage);
  const { rows } = await query(
    `SELECT s.*, v.name AS view_name FROM family_shares s LEFT JOIN family_views v ON v.id = s.view_id
     WHERE s.tree_id = $1 AND s.revoked_at IS NULL ORDER BY s.created_at DESC`,
    [treeId]
  );
  return rows.map(shareShape);
}

export async function createShare(ctx, treeId, input = {}) {
  requireLevel(await levelOn(ACL, treeId, ctx), LEVEL.manage);
  const share = await cleanShareInput(treeId, input);
  const token = randomBytes(15).toString('base64url');
  const { rows } = await query(
    `INSERT INTO family_shares (tree_id, token, title, password_hash, expires_at, created_by, view_id, access, allow_clone, ask_name, ask_phone, theme, theme_locked, assistant)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [treeId, token, share.title, share.passwordHash, share.expiresAt, ctx.userId, share.viewId, share.access, share.allowClone, share.askName, share.askPhone, share.theme, share.themeLocked, share.assistant]
  );
  return shareShape(rows[0]);
}

export async function updateShare(ctx, id, input = {}) {
  const row = await shareRow(id);
  requireLevel(await levelOn(ACL, row.tree_id, ctx), LEVEL.manage);
  const share = await cleanShareInput(row.tree_id, input, row);
  const bump = share.passwordHash !== row.password_hash ? 1 : 0;
  const { rows } = await query(
    `UPDATE family_shares SET title = $2, password_hash = $3, expires_at = $4, version = version + $5, view_id = $6, access = $7, allow_clone = $8,
       ask_name = $9, ask_phone = $10, theme = $11, theme_locked = $12, assistant = $13
     WHERE id = $1 RETURNING *`,
    [id, share.title, share.passwordHash, share.expiresAt, bump, share.viewId, share.access, share.allowClone, share.askName, share.askPhone, share.theme, share.themeLocked, share.assistant]
  );
  return shareShape(rows[0]);
}

export async function deleteShare(ctx, id) {
  const row = await shareRow(id);
  requireLevel(await levelOn(ACL, row.tree_id, ctx), LEVEL.manage);
  await query(`UPDATE family_shares SET revoked_at = NOW(), version = version + 1 WHERE id = $1`, [id]);
}

// ── Public side ─────────────────────────────────────────────────────────────

const secret = () => `${config.auth.jwtSecret || 'dev'}:family-share`;

function issueToken(row) {
  return jwt.sign({ sid: row.id, v: row.version }, secret(), { expiresIn: '12h' });
}

/** A link lives only while its author still manages the tree. */
async function assertAuthor(row) {
  const gone = () => httpError(410, 'This link is no longer available', 'OWNER_INACTIVE');
  if (!row.created_by) throw gone();
  const author = await requestAs(row.created_by);
  if (!author) throw gone();
  if ((await levelOn(ACL, row.tree_id, contextFromRequest(author, 'family.admin'))) < LEVEL.manage) throw gone();
}

async function liveRow(token) {
  const settings = await familySettings();
  const row = (await query(`SELECT * FROM family_shares WHERE token = $1`, [String(token || '')])).rows[0];
  if (!row || row.revoked_at || !settings.publicLinks) throw httpError(404, 'This link does not exist', 'NOT_FOUND');
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw httpError(410, 'This link has expired', 'EXPIRED');
  return row;
}

export async function resolveShare(token, unlockToken) {
  const row = await liveRow(token);
  await assertAuthor(row);
  if (row.password_hash) {
    let ok = false;
    try {
      const payload = jwt.verify(String(unlockToken || ''), secret());
      ok = payload.sid === row.id && payload.v === row.version;
    } catch {
      ok = false;
    }
    if (!ok) {
      const error = httpError(401, 'This link is protected by a password', 'PASSWORD_REQUIRED');
      error.details = lookOf(row);
      throw error;
    }
  }
  return row;
}

export async function unlockShare(token, password) {
  const row = await liveRow(token);
  if (!row.password_hash) return { token: null };
  if (!(await bcrypt.compare(String(password || ''), row.password_hash))) throw httpError(401, 'Wrong password', 'WRONG_PASSWORD');
  return { token: issueToken(row) };
}

export async function publicTree(row) {
  const tree = (await query(`SELECT name, description, home_person_id FROM family_trees WHERE id = $1`, [row.tree_id])).rows[0];
  const { graph, view } = await graphOfView(row.tree_id, row.view_id, `/api/t/${row.token}`);
  // Visitors see the family, not how to reach people: contacts stay private.
  for (const person of graph.persons) person.contacts = {};
  return {
    tree: {
      name: row.title || view?.name || tree.name,
      description: view ? view.description : tree.description || '',
      homePersonId: view?.filter.focus || tree.home_person_id || null,
    },
    share: {
      access: ACCESS.includes(row.access) ? row.access : 'view',
      allowClone: row.allow_clone !== false,
      theme: THEMES.includes(row.theme) ? row.theme : 'system',
      themeLocked: Boolean(row.theme_locked),
      assistant: Boolean(row.assistant),
    },
    ...graph,
  };
}

// ── Visitors: who opened the link ──────────────────────────────────────────

const visitorSecret = () => `${config.auth.jwtSecret || 'dev'}:family-visitor`;
const PHONE_RE = /^[+()\d\s-]{5,40}$/;

/** How the link looks, also on its password and introduction screens. */
export function lookOf(row) {
  return { theme: THEMES.includes(row.theme) ? row.theme : 'system', themeLocked: Boolean(row.theme_locked), assistant: Boolean(row.assistant), access: row.access };
}

/** What the link asks of a visitor before the tree opens. */
export function identityRule(row) {
  const askPhone = PHONE.includes(row.ask_phone) ? row.ask_phone : 'off';
  return { askName: Boolean(row.ask_name) || askPhone !== 'off', askPhone };
}

/** A visitor introduces themselves: checked against the link's rules, signed for 30 days. */
export function hello(row, input = {}) {
  const rule = identityRule(row);
  const name = String(input.name || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const phone = String(input.phone || '').trim().slice(0, 40);
  if (rule.askName && name.length < 2) throw httpError(400, 'Enter your name', 'NAME_REQUIRED');
  if (rule.askPhone === 'required' && !phone) throw httpError(400, 'Enter your phone number', 'PHONE_REQUIRED');
  if (phone && !PHONE_RE.test(phone)) throw httpError(400, 'This does not look like a phone number', 'BAD_PHONE');
  if (!name) throw httpError(400, 'Enter your name', 'NAME_REQUIRED');
  const visitor = { name, phone: rule.askPhone === 'off' ? '' : phone };
  return { visitor, token: jwt.sign({ sid: row.id, n: visitor.name, p: visitor.phone }, visitorSecret(), { expiresIn: '30d' }) };
}

/** The visitor of a request (X-Visitor header), or null. */
export function visitorOf(row, token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(String(token), visitorSecret());
    if (payload.sid !== row.id || !payload.n) return null;
    return { name: payload.n, phone: payload.p || '' };
  } catch {
    return null;
  }
}

/** Throws IDENTITY_REQUIRED (with what to ask) when the link wants a visitor who has not introduced themselves. */
export function requireIdentity(row, visitor) {
  const rule = identityRule(row);
  // A token from before the link started to require a phone does not count.
  if (!rule.askName || (visitor && (rule.askPhone !== 'required' || visitor.phone))) return;
  const error = httpError(401, 'Introduce yourself to open this tree', 'IDENTITY_REQUIRED');
  error.details = { ...rule, ...lookOf(row) };
  throw error;
}

export async function countView(row) {
  await query(`UPDATE family_shares SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = $1`, [row.id]);
}
