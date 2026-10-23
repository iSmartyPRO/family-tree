import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { countsAsView } from '../../services/linkPreview/meta.js';
import { query } from '../../config/database.js';
import { contextFromRequest, httpError, intId as id, wrap } from '../shared/acl.js';
import { unlockLimiters } from '../shared/linkPasswords.js';
import {
  addParent,
  addUnion,
  createPerson,
  createTree,
  deletePerson,
  deletePhoto,
  deleteTree,
  exportGedcom,
  exportTree,
  familySettings,
  getAccess,
  getTree,
  importInto,
  listSubjects,
  listTrees,
  removeParent,
  removeUnion,
  sendPersonPhoto,
  sendPhoto,
  setAccess,
  updateParent,
  updatePerson,
  updateTree,
  updateUnion,
  uploadPhoto,
} from './service.js';
import { countView, createShare, deleteShare, listShares, publicTree, resolveShare, unlockShare, updateShare } from './shares.js';
import { cloneGraph, cloneTree, createView, deleteView, graphOfView, listViews, meOf, selectIds, setMe, updateView } from './views.js';
import { listSuggestions, reviewSuggestion, sendSuggestionPhoto, suggest, suggestPhoto, visibleIds } from './suggestions.js';
import { addressKey } from '../shared/linkPasswords.js';
import { listLog, logEvent, personLabel, treeOf } from './log.js';
import { hello, identityRule, requireIdentity, visitorOf } from './shares.js';

// Activity log helpers: signed-in members and link visitors.
const member = (req) => ({ userId: req.family?.userId || null });
const log = (req, treeId, action, opts = {}) => logEvent(req, treeId, action, { who: member(req), ...opts });

const fileName = (name, ext) => `${String(name || 'family-tree').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'family-tree'}.${ext}`;

function attachment(res, name, type) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="tree.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// ── Signed-in users: /api/app/family ───────────────────────────────────────

export function privateRoutes() {
  const router = Router();

  router.use((req, res, next) => {
    req.family = contextFromRequest(req, 'family.admin');
    next();
  });

  router.get('/', wrap(async (req, res) => {
    const settings = await familySettings();
    res.json({
      success: true,
      trees: await listTrees(req.family),
      config: {
        maxPhotoMb: settings.maxPhotoMb,
        publicLinks: settings.publicLinks,
        requireSharePassword: settings.requireSharePassword,
        maxShareDays: settings.maxShareDays,
        isAdmin: req.family.isAdmin,
      },
    });
  }));

  router.get('/subjects', wrap(async (_req, res) => {
    res.json({ success: true, ...(await listSubjects()) });
  }));

  // Trees
  router.post('/trees', wrap(async (req, res) => {
    const treeId = await createTree(req.family, req.body || {});
    await log(req, treeId, 'tree.create', { details: { name: req.body?.name } });
    res.status(201).json({ success: true, id: treeId });
  }));
  router.get('/trees/:id/log', wrap(async (req, res) => {
    res.json({ success: true, ...(await listLog(req.family, id(req.params.id), req.query)) });
  }));
  router.get('/trees/:id', wrap(async (req, res) => {
    const treeId = id(req.params.id);
    const data = await getTree(req.family, treeId);
    const [views, meId, pending] = await Promise.all([
      listViews(treeId),
      meOf(req.family, treeId),
      ['edit', 'manage'].includes(data.tree.level)
        ? query(`SELECT COUNT(*)::int AS n FROM family_suggestions WHERE tree_id = $1 AND status = 'pending'`, [treeId]).then((r) => r.rows[0].n)
        : 0,
    ]);
    res.json({ success: true, ...data, views, meId, pendingSuggestions: pending });
  }));
  router.put('/trees/:id/me', wrap(async (req, res) => {
    res.json({ success: true, meId: await setMe(req.family, id(req.params.id), Number(req.body?.personId) || null) });
  }));
  router.post('/trees/:id/select', wrap(async (req, res) => {
    res.json({ success: true, ...(await selectIds(req.family, id(req.params.id), req.body?.filter || {})) });
  }));
  router.get('/trees/:id/views', wrap(async (req, res) => {
    await getTree(req.family, id(req.params.id));
    res.json({ success: true, views: await listViews(id(req.params.id)) });
  }));
  router.post('/trees/:id/views', wrap(async (req, res) => {
    const view = await createView(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'view.create', { details: { name: view.name } });
    res.status(201).json({ success: true, view });
  }));
  router.put('/views/:id', wrap(async (req, res) => {
    const view = await updateView(req.family, id(req.params.id), req.body || {});
    await log(req, await treeOf('family_views', view.id), 'view.update', { details: { name: view.name } });
    res.json({ success: true, view });
  }));
  router.delete('/views/:id', wrap(async (req, res) => {
    const treeId = await treeOf('family_views', id(req.params.id));
    const name = (await query(`SELECT name FROM family_views WHERE id = $1`, [id(req.params.id)])).rows[0]?.name;
    await deleteView(req.family, id(req.params.id));
    await log(req, treeId, 'view.delete', { details: { name } });
    res.json({ success: true });
  }));
  router.post('/trees/:id/clone', wrap(async (req, res) => {
    const result = await cloneTree(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'tree.clone', { details: { name: req.body?.name, persons: result.persons } });
    res.status(201).json({ success: true, ...result });
  }));
  // Save a tree shared by a link into one's own trees (when the link allows it).
  router.post('/clone-link', cloneLimiter, wrap(async (req, res) => {
    const share = await resolveShare(req.body?.token, req.body?.unlock);
    if (share.allow_clone === false) throw httpError(403, 'Copying is turned off for this link', 'NO_CLONE');
    const { graph, view } = await graphOfView(share.tree_id, share.view_id);
    const tree = (await query(`SELECT name FROM family_trees WHERE id = $1`, [share.tree_id])).rows[0];
    const name = String(req.body?.name || share.title || view?.name || tree?.name || '').trim();
    const result = await cloneGraph(req.family, share.tree_id, graph, { name });
    await logEvent(req, share.tree_id, 'link.clone', { who: { userId: req.family.userId, shareId: share.id }, details: { name, persons: result.persons } });
    res.status(201).json({ success: true, ...result });
  }));

  // Suggestions from public links
  router.get('/trees/:id/suggestions', wrap(async (req, res) => {
    res.json({ success: true, ...(await listSuggestions(req.family, id(req.params.id), req.query.status)) });
  }));
  router.post('/suggestions/:id/accept', wrap(async (req, res) => {
    const r = await reviewSuggestion(req.family, id(req.params.id), true);
    await log(req, r.treeId, 'suggestion.accept', { personId: r.resultPersonId || r.personId, details: { kind: r.kind, author: r.authorName } });
    res.json({ success: true, ...r });
  }));
  router.post('/suggestions/:id/reject', wrap(async (req, res) => {
    const r = await reviewSuggestion(req.family, id(req.params.id), false);
    await log(req, r.treeId, 'suggestion.reject', { personId: r.personId, details: { kind: r.kind, author: r.authorName } });
    res.json({ success: true, ...r });
  }));
  router.get('/suggestions/:id/photo', wrap(async (req, res) => {
    await sendSuggestionPhoto(req.family, id(req.params.id), res);
  }));
  router.put('/trees/:id', wrap(async (req, res) => {
    await updateTree(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'tree.update', { details: { fields: Object.keys(req.body || {}) } });
    res.json({ success: true });
  }));
  router.delete('/trees/:id', wrap(async (req, res) => {
    await deleteTree(req.family, id(req.params.id));
    res.json({ success: true });
  }));
  router.get('/trees/:id/access', wrap(async (req, res) => {
    res.json({ success: true, ...(await getAccess(req.family, id(req.params.id))) });
  }));
  router.put('/trees/:id/access', wrap(async (req, res) => {
    await setAccess(req.family, id(req.params.id), req.body?.entries);
    await log(req, id(req.params.id), 'access.update', { details: { entries: (req.body?.entries || []).length } });
    res.json({ success: true });
  }));
  router.get('/trees/:id/export', wrap(async (req, res) => {
    const treeId = id(req.params.id);
    if (req.query.format === 'gedcom') {
      const { name, text } = await exportGedcom(req.family, treeId);
      await log(req, treeId, 'tree.export', { details: { format: 'gedcom' } });
      attachment(res, fileName(name, 'ged'), 'text/plain; charset=utf-8');
      res.send(text);
      return;
    }
    const data = await exportTree(req.family, treeId);
    await log(req, treeId, 'tree.export', { details: { format: 'json' } });
    attachment(res, fileName(data.tree.name, 'json'), 'application/json; charset=utf-8');
    res.send(JSON.stringify(data, null, 2));
  }));
  router.post('/trees/:id/import', wrap(async (req, res) => {
    const result = await importInto(req.family, id(req.params.id), req.body?.data);
    await log(req, id(req.params.id), 'tree.import', { details: result });
    res.json({ success: true, ...result });
  }));

  // People
  router.post('/trees/:id/persons', wrap(async (req, res) => {
    const person = await createPerson(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'person.create', { personId: person.id, details: { relation: req.body?.relation?.type || null, of: req.body?.relation?.personId ? await personLabel(req.body.relation.personId) : null } });
    res.status(201).json({ success: true, person });
  }));
  router.put('/persons/:id', wrap(async (req, res) => {
    const person = await updatePerson(req.family, id(req.params.id), req.body || {});
    await log(req, await treeOf('family_persons', person.id), 'person.update', { personId: person.id, details: { fields: Object.keys(req.body || {}) } });
    res.json({ success: true, person });
  }));
  router.delete('/persons/:id', wrap(async (req, res) => {
    const treeId = await treeOf('family_persons', id(req.params.id));
    const name = await personLabel(id(req.params.id));
    await deletePerson(req.family, id(req.params.id));
    await log(req, treeId, 'person.delete', { personId: id(req.params.id), personName: name });
    res.json({ success: true });
  }));
  router.get('/persons/:id/photo', wrap(async (req, res) => {
    await sendPhoto(req.family, id(req.params.id), res, req.query.size);
  }));
  router.post('/persons/:id/photo', wrap(async (req, res) => {
    const person = await uploadPhoto(req.family, id(req.params.id), req, res);
    await log(req, await treeOf('family_persons', person.id), 'photo.set', { personId: person.id });
    res.json({ success: true, person });
  }));
  router.delete('/persons/:id/photo', wrap(async (req, res) => {
    const person = await deletePhoto(req.family, id(req.params.id));
    await log(req, await treeOf('family_persons', person.id), 'photo.remove', { personId: person.id });
    res.json({ success: true, person });
  }));

  // Links
  router.post('/trees/:id/parents', wrap(async (req, res) => {
    const link = await addParent(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'parent.add', { personId: link.childId, details: { parent: await personLabel(link.parentId) } });
    res.status(201).json({ success: true, link });
  }));
  router.put('/parents/:id', wrap(async (req, res) => {
    await updateParent(req.family, id(req.params.id), req.body || {});
    res.json({ success: true });
  }));
  router.delete('/parents/:id', wrap(async (req, res) => {
    const row = (await query(`SELECT * FROM family_parents WHERE id = $1`, [id(req.params.id)])).rows[0];
    const parent = row ? await personLabel(row.parent_id) : '';
    await removeParent(req.family, id(req.params.id));
    if (row) await log(req, row.tree_id, 'parent.remove', { personId: row.child_id, details: { parent } });
    res.json({ success: true });
  }));
  router.post('/trees/:id/unions', wrap(async (req, res) => {
    const union = await addUnion(req.family, id(req.params.id), req.body || {});
    await log(req, id(req.params.id), 'union.add', { personId: union.partnerA, details: { partner: await personLabel(union.partnerB), status: union.status } });
    res.status(201).json({ success: true, union });
  }));
  router.put('/unions/:id', wrap(async (req, res) => {
    await updateUnion(req.family, id(req.params.id), req.body || {});
    const u = (await query(`SELECT * FROM family_unions WHERE id = $1`, [id(req.params.id)])).rows[0];
    if (u) await log(req, u.tree_id, 'union.update', { personId: u.partner_a, details: { partner: await personLabel(u.partner_b), status: u.status, startDate: u.start_date, endDate: u.end_date } });
    res.json({ success: true });
  }));
  router.delete('/unions/:id', wrap(async (req, res) => {
    const u = (await query(`SELECT * FROM family_unions WHERE id = $1`, [id(req.params.id)])).rows[0];
    const partner = u ? await personLabel(u.partner_b) : '';
    await removeUnion(req.family, id(req.params.id));
    if (u) await log(req, u.tree_id, 'union.remove', { personId: u.partner_a, details: { partner } });
    res.json({ success: true });
  }));

  // Public links
  router.get('/trees/:id/shares', wrap(async (req, res) => {
    res.json({ success: true, shares: await listShares(req.family, id(req.params.id)) });
  }));
  router.post('/trees/:id/shares', wrap(async (req, res) => {
    const share = await createShare(req.family, id(req.params.id), req.body || {});
    await logEvent(req, id(req.params.id), 'share.create', { who: { userId: req.family.userId, shareId: share.id }, details: { title: share.title, access: share.access, viewId: share.viewId, askName: share.askName, askPhone: share.askPhone } });
    res.status(201).json({ success: true, share });
  }));
  router.put('/shares/:id', wrap(async (req, res) => {
    const share = await updateShare(req.family, id(req.params.id), req.body || {});
    await logEvent(req, await treeOf('family_shares', share.id), 'share.update', { who: { userId: req.family.userId, shareId: share.id }, details: { access: share.access } });
    res.json({ success: true, share });
  }));
  router.delete('/shares/:id', wrap(async (req, res) => {
    const treeId = await treeOf('family_shares', id(req.params.id));
    await deleteShare(req.family, id(req.params.id));
    await logEvent(req, treeId, 'share.revoke', { who: { userId: req.family.userId, shareId: id(req.params.id) } });
    res.json({ success: true });
  }));

  return router;
}

// ── Anonymous visitors: /api/t ─────────────────────────────────────────────

const unlockLimiter = unlockLimiters('family', (req) => String(req.params.token || ''));
// Visitors of a link may send a few dozen changes an hour, not a flood.
const suggestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `family-s:${addressKey(req.ip)}:${req.params.token}`,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Too many changes. Try again later.', code: 'RATE_LIMITED' }),
});
const unlockOf = (req) => req.get('x-share-token') || req.query.t || '';
const visitorHeader = (req) => req.get('x-visitor') || '';
// Introductions: per visitor address only — a failed one is not a password guess,
// so it must not spend a budget shared by everyone who opens the link.
const helloLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `family-h:${addressKey(req.ip)}:${req.params.token}`,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' }),
});
// Copying a shared tree copies its photos too: a few copies an hour per person.
const cloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `family-c:${contextFromRequest(req)?.userId || addressKey(req.ip)}`,
  handler: (_req, res) => res.status(429).json({ success: false, error: 'Too many copies. Try again later.', code: 'RATE_LIMITED' }),
});

export function publicRoutes() {
  const router = Router();

  router.post('/:token/unlock', unlockLimiter, wrap(async (req, res) => {
    res.json({ success: true, ...(await unlockShare(req.params.token, req.body?.password)) });
  }));

  // A visitor introduces themselves (when the link asks, or before proposing a change).
  router.post('/:token/hello', helloLimiter, wrap(async (req, res) => {
    const share = await resolveShare(req.params.token, unlockOf(req));
    const { visitor, token } = hello(share, req.body || {});
    await logEvent(req, share.tree_id, 'link.hello', { who: { shareId: share.id, visitor } });
    res.json({ success: true, visitor, token });
  }));

  router.get('/:token', wrap(async (req, res) => {
    const share = await resolveShare(req.params.token, unlockOf(req));
    const visitor = visitorOf(share, visitorHeader(req));
    requireIdentity(share, visitor);
    if (countsAsView(req)) {
      await countView(share);
      await logEvent(req, share.tree_id, 'link.open', { who: { shareId: share.id, visitor: visitor || {} } });
    }
    const data = await publicTree(share);
    res.json({ success: true, ...data, share: { ...data.share, ...identityRule(share) }, visitor });
  }));

  router.post('/:token/suggest', suggestLimiter, wrap(async (req, res) => {
    const share = await resolveShare(req.params.token, unlockOf(req));
    const visitor = visitorOf(share, visitorHeader(req));
    requireIdentity(share, visitor);
    const result = await suggest(share, req.body || {}, visitor);
    await logEvent(req, share.tree_id, `${result.applied ? 'edit' : 'suggest'}.${result.kind}`, {
      who: { shareId: share.id, visitor: visitor || { name: result.author?.name, phone: result.author?.phone } },
      personId: result.kind === 'relative' && result.applied ? result.personId : result.anchorId,
      details: { fields: result.changed, relation: req.body?.relation?.type || null },
    });
    res.json({ success: true, applied: result.applied, personId: result.personId || null });
  }));

  router.post('/:token/persons/:id/photo', suggestLimiter, wrap(async (req, res) => {
    const share = await resolveShare(req.params.token, unlockOf(req));
    const visitor = visitorOf(share, visitorHeader(req));
    requireIdentity(share, visitor);
    const result = await suggestPhoto(share, id(req.params.id), req, res, visitor);
    await logEvent(req, share.tree_id, `${result.applied ? 'edit' : 'suggest'}.photo`, {
      who: { shareId: share.id, visitor: visitor || { name: result.author?.name, phone: result.author?.phone } },
      personId: id(req.params.id),
    });
    res.json({ success: true, applied: result.applied });
  }));

  router.get('/:token/persons/:id/photo', wrap(async (req, res) => {
    const share = await resolveShare(req.params.token, unlockOf(req));
    // Only people of the link's view: ids are sequential, the rest must stay hidden.
    if (!(await visibleIds(share)).has(id(req.params.id))) throw httpError(404, 'Not found', 'NOT_FOUND');
    const row = (await query(`SELECT * FROM family_persons WHERE id = $1 AND tree_id = $2`, [id(req.params.id), share.tree_id])).rows[0];
    if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
    await sendPersonPhoto(res, row, req.query.size);
  }));

  return router;
}
