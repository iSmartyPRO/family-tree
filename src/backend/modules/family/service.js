import multer from 'multer';
import { query, withTransaction } from '../../config/database.js';
import { getSettings, parseSettings } from '../../services/settings.js';
import {
  LEVEL,
  LEVEL_NAMES,
  httpError,
  levelMap,
  levelOn,
  listSubjects as aclSubjects,
  readAcl,
  requireLevel,
  writeAcl,
} from '../shared/acl.js';
import { extOf, newStorageKey, originalName, removeBlob, sendBlob, storagePath, verifyContent } from '../shared/storage.js';
import { checkParentLink, checkUnion, cleanDate, cleanPerson, cleanTree, cleanUnion, PARENT_KINDS, fullName } from './rules.js';

const ACL = 'family_tree_acl';
const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'webp'];

export async function familySettings() {
  return parseSettings(await getSettings()).modules.family.settings;
}

// ── Shapes ──────────────────────────────────────────────────────────────────

/** `photoBase` is where photos are served: the private API or a public link. */
export function personShape(row, photoBase = '/api/app/family') {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    patronymic: row.patronymic,
    maidenName: row.maiden_name,
    gender: row.gender,
    birthDate: row.birth_date,
    birthPlace: row.birth_place,
    isAlive: row.is_alive,
    deathDate: row.death_date,
    deathPlace: row.death_place,
    occupation: row.occupation,
    bio: row.bio,
    contacts: row.contacts || {},
    familyOrder: Array.isArray(row.family_order) ? row.family_order : [],
    photoUrl: row.photo_key ? `${photoBase}/persons/${row.id}/photo?v=${row.photo_version}` : null,
    photoFullUrl: row.photo_key && row.photo_full_key ? `${photoBase}/persons/${row.id}/photo?size=full&v=${row.photo_version}` : null,
    updatedAt: row.updated_at,
  };
}

const parentShape = (row) => ({ id: row.id, childId: row.child_id, parentId: row.parent_id, kind: row.kind });
const unionShape = (row) => ({
  id: row.id,
  partnerA: row.partner_a,
  partnerB: row.partner_b,
  status: row.status,
  startDate: row.start_date,
  endDate: row.end_date,
});

function treeShape(row, level) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    homePersonId: row.home_person_id || null,
    showUnknownParents: row.show_unknown_parents !== false,
    personCount: Number(row.person_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    level: LEVEL_NAMES[level] || 'none',
  };
}

// ── Access ──────────────────────────────────────────────────────────────────

export async function treeLevel(ctx, treeId) {
  const exists = await query(`SELECT 1 FROM family_trees WHERE id = $1`, [treeId]);
  if (!exists.rowCount) throw httpError(404, 'Not found', 'NOT_FOUND');
  return levelOn(ACL, treeId, ctx);
}

async function requireTree(ctx, treeId, needed) {
  const level = await treeLevel(ctx, treeId);
  requireLevel(level, needed);
  return level;
}

async function personRow(personId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const row = (await run(`SELECT * FROM family_persons WHERE id = $1`, [personId])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

/** The person, checked for `needed` access on their tree. */
async function requirePerson(ctx, personId, needed) {
  const row = await personRow(personId);
  await requireTree(ctx, row.tree_id, needed);
  return row;
}

async function touchTree(client, treeId, userId) {
  await client.query(`UPDATE family_trees SET updated_at = NOW(), updated_by = $2 WHERE id = $1`, [treeId, userId]);
}

// ── Trees ───────────────────────────────────────────────────────────────────

export async function listTrees(ctx) {
  const levels = await levelMap(ACL, ctx);
  const ids = ctx.isAdmin ? null : levels.visibleIds();
  if (ids && !ids.length) return [];
  const { rows } = await query(
    `SELECT t.*, (SELECT COUNT(*) FROM family_persons p WHERE p.tree_id = t.id) AS person_count
     FROM family_trees t
     ${ids ? 'WHERE t.id = ANY($1::int[])' : ''}
     ORDER BY t.updated_at DESC`,
    ids ? [ids] : []
  );
  const trees = rows.map((row) => treeShape(row, levels.of(row.id)));
  // A few faces for the tree card.
  if (trees.length) {
    const faces = await query(
      `SELECT tree_id, id, photo_version FROM (
         SELECT tree_id, id, photo_version, ROW_NUMBER() OVER (PARTITION BY tree_id ORDER BY updated_at DESC) AS n
         FROM family_persons WHERE photo_key IS NOT NULL AND tree_id = ANY($1::int[])
       ) x WHERE n <= 4`,
      [trees.map((tree) => tree.id)]
    );
    for (const tree of trees) {
      tree.faces = faces.rows
        .filter((row) => row.tree_id === tree.id)
        .map((row) => `/api/app/family/persons/${row.id}/photo?v=${row.photo_version}`);
    }
  }
  return trees;
}

export async function createTree(ctx, input) {
  const tree = cleanTree(input);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO family_trees (name, description, show_unknown_parents, created_by, updated_by) VALUES ($1, $2, $4, $3, $3) RETURNING id`,
      [tree.name, tree.description, ctx.userId, tree.showUnknownParents]
    );
    const id = rows[0].id;
    await writeAcl(client, ACL, id, [{ subjectType: 'user', subjectId: ctx.userId, level: 'manage' }], null);
    return id;
  });
}

export async function updateTree(ctx, treeId, input) {
  await requireTree(ctx, treeId, LEVEL.manage);
  const current = (await query(`SELECT * FROM family_trees WHERE id = $1`, [treeId])).rows[0];
  const tree = cleanTree(input, current);
  let home = current.home_person_id;
  if (input.homePersonId !== undefined) {
    home = input.homePersonId ? Number(input.homePersonId) : null;
    if (home) {
      const person = await personRow(home);
      if (person.tree_id !== treeId) throw httpError(400, 'This person is not in the tree', 'WRONG_TREE');
    }
  }
  await query(
    `UPDATE family_trees SET name = $2, description = $3, home_person_id = $4, show_unknown_parents = $6, updated_by = $5, updated_at = NOW() WHERE id = $1`,
    [treeId, tree.name, tree.description, home, ctx.userId, tree.showUnknownParents]
  );
}

export async function deleteTree(ctx, treeId) {
  await requireTree(ctx, treeId, LEVEL.manage);
  const photos = await query(`SELECT photo_key, photo_full_key FROM family_persons WHERE tree_id = $1 AND photo_key IS NOT NULL`, [treeId]);
  await query(`DELETE FROM family_trees WHERE id = $1`, [treeId]);
  for (const row of photos.rows) {
    await removeBlob(row.photo_key);
    await removeBlob(row.photo_full_key);
  }
}

/** Everything the canvas needs in one answer: the tree is small enough. */
export async function loadGraph(treeId, photoBase) {
  const [persons, parents, unions] = await Promise.all([
    query(`SELECT * FROM family_persons WHERE tree_id = $1 ORDER BY id`, [treeId]),
    query(`SELECT * FROM family_parents WHERE tree_id = $1 ORDER BY id`, [treeId]),
    query(`SELECT * FROM family_unions WHERE tree_id = $1 ORDER BY id`, [treeId]),
  ]);
  return {
    persons: persons.rows.map((row) => personShape(row, photoBase)),
    parents: parents.rows.map(parentShape),
    unions: unions.rows.map(unionShape),
  };
}

export async function getTree(ctx, treeId) {
  const level = await requireTree(ctx, treeId, LEVEL.view);
  const row = (
    await query(
      `SELECT t.*, (SELECT COUNT(*) FROM family_persons p WHERE p.tree_id = t.id) AS person_count FROM family_trees t WHERE t.id = $1`,
      [treeId]
    )
  ).rows[0];
  return { tree: treeShape(row, level), ...(await loadGraph(treeId)) };
}

// ── People ──────────────────────────────────────────────────────────────────

async function insertPerson(client, treeId, person, userId) {
  const { rows } = await client.query(
    `INSERT INTO family_persons (tree_id, first_name, last_name, patronymic, maiden_name, gender, birth_date, birth_place,
       is_alive, death_date, death_place, occupation, bio, contacts, created_by, updated_by, family_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16) RETURNING *`,
    [
      treeId,
      person.firstName,
      person.lastName,
      person.patronymic,
      person.maidenName,
      person.gender,
      person.birthDate,
      person.birthPlace,
      person.isAlive,
      person.deathDate,
      person.deathPlace,
      person.occupation,
      person.bio,
      JSON.stringify(person.contacts),
      userId,
      JSON.stringify(person.familyOrder || []),
    ]
  );
  return rows[0];
}

async function graphLinks(client, treeId) {
  const [parents, unions] = await Promise.all([
    client.query(`SELECT child_id, parent_id FROM family_parents WHERE tree_id = $1`, [treeId]),
    client.query(`SELECT partner_a, partner_b FROM family_unions WHERE tree_id = $1`, [treeId]),
  ]);
  return {
    links: parents.rows.map((row) => ({ childId: row.child_id, parentId: row.parent_id })),
    unions: unions.rows.map((row) => ({ partnerA: row.partner_a, partnerB: row.partner_b })),
  };
}

/** Link checks read the whole graph: one writer per tree at a time (inside a transaction). */
async function lockTree(client, treeId) {
  await client.query(`SELECT pg_advisory_xact_lock(7311, $1::int)`, [treeId]);
}

async function linkParent(client, treeId, childId, parentId, kind = 'birth') {
  await lockTree(client, treeId);
  const { links } = await graphLinks(client, treeId);
  checkParentLink(links, childId, parentId);
  const { rows } = await client.query(
    `INSERT INTO family_parents (tree_id, child_id, parent_id, kind) VALUES ($1, $2, $3, $4) RETURNING *`,
    [treeId, childId, parentId, PARENT_KINDS.includes(kind) ? kind : 'birth']
  );
  return rows[0];
}

async function linkUnion(client, treeId, a, b, input = {}) {
  await lockTree(client, treeId);
  const { links, unions } = await graphLinks(client, treeId);
  checkUnion(links, unions, a, b);
  const union = cleanUnion(input);
  try {
    const { rows } = await client.query(
      `INSERT INTO family_unions (tree_id, partner_a, partner_b, status, start_date, end_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [treeId, a, b, union.status, union.startDate, union.endDate]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'These two are already a couple', 'DUPLICATE');
    throw err;
  }
}

async function samePersonTree(client, treeId, ids) {
  for (const id of ids) {
    const row = await personRow(id, client);
    if (row.tree_id !== treeId) throw httpError(400, 'This person is not in the tree', 'WRONG_TREE');
  }
}

/**
 * Adds a person, optionally already linked to someone in the tree:
 *   relation: { type: 'child' | 'parent' | 'partner' | 'sibling' | 'coparent', personId, otherParentId?, status?, childIds?, parentName? }
 * 'sibling' of someone with no parents first adds their father, named `parentName`.
 * 'coparent' fills in the unknown other parent of some of `personId`'s children:
 * the new person becomes their partner and those children's second parent.
 * A new parent of someone who already has one parent becomes that parent's
 * partner, so the family is drawn as a couple right away.
 */
export async function createPerson(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const person = cleanPerson(input);
  const relation = input.relation && typeof input.relation === 'object' ? input.relation : null;
  return withTransaction(async (client) => {
    const row = await insertPerson(client, treeId, person, ctx.userId);
    if (relation) {
      const anchor = Number(relation.personId);
      await samePersonTree(client, treeId, [anchor]);
      switch (relation.type) {
        case 'child': {
          await linkParent(client, treeId, row.id, anchor);
          const other = Number(relation.otherParentId) || null;
          if (other) {
            await samePersonTree(client, treeId, [other]);
            await linkParent(client, treeId, row.id, other);
          }
          break;
        }
        case 'parent': {
          const existing = await client.query(`SELECT parent_id FROM family_parents WHERE child_id = $1`, [anchor]);
          await linkParent(client, treeId, anchor, row.id);
          if (existing.rowCount === 1 && relation.joinCouple !== false) {
            const otherParent = existing.rows[0].parent_id;
            const coupled = await client.query(
              `SELECT 1 FROM family_unions WHERE LEAST(partner_a, partner_b) = LEAST($1::int, $2::int) AND GREATEST(partner_a, partner_b) = GREATEST($1::int, $2::int)`,
              [otherParent, row.id]
            );
            if (!coupled.rowCount) await linkUnion(client, treeId, otherParent, row.id, { status: relation.status || 'married' });
          }
          break;
        }
        case 'partner':
          await linkUnion(client, treeId, anchor, row.id, { status: relation.status || 'married', startDate: relation.startDate });
          break;
        case 'coparent': {
          const childIds = [...new Set((relation.childIds || []).map(Number).filter(Boolean))];
          if (!childIds.length) throw httpError(400, 'Choose the children', 'NO_CHILDREN');
          for (const childId of childIds) {
            const links = await client.query(`SELECT parent_id FROM family_parents WHERE child_id = $1`, [childId]);
            const list = links.rows.map((r) => r.parent_id);
            if (list.length !== 1 || list[0] !== anchor) throw httpError(400, 'These children already have both parents', 'HAS_PARENTS');
            await linkParent(client, treeId, childId, row.id);
          }
          await linkUnion(client, treeId, anchor, row.id, { status: relation.status || 'married' });
          break;
        }
        case 'sibling': {
          let parents = await client.query(`SELECT parent_id, kind FROM family_parents WHERE child_id = $1`, [anchor]);
          if (!parents.rowCount) {
            // Siblings are linked through a parent: with none known yet, both get a
            // father to fill in later (the mother shows as «not set» next to him).
            const father = await insertPerson(client, treeId, cleanPerson({ firstName: String(relation.parentName || '').trim().slice(0, 80) || '?', gender: 'male' }), ctx.userId);
            await linkParent(client, treeId, anchor, father.id);
            parents = { rows: [{ parent_id: father.id, kind: 'birth' }] };
          }
          for (const parent of parents.rows) await linkParent(client, treeId, row.id, parent.parent_id, parent.kind);
          break;
        }
        default:
          throw httpError(400, 'Unknown relation', 'BAD_RELATION');
      }
    }
    await touchTree(client, treeId, ctx.userId);
    return personShape(row);
  });
}

export async function updatePerson(ctx, personId, input = {}) {
  await requirePerson(ctx, personId, LEVEL.edit);
  return withTransaction(async (client) => {
    // Fields that are not sent keep their value: read them under a lock, so
    // two people editing different fields do not undo each other.
    const locked = (await client.query(`SELECT * FROM family_persons WHERE id = $1 FOR UPDATE`, [personId])).rows[0];
    if (!locked) throw httpError(404, 'Person not found', 'NOT_FOUND');
    const person = cleanPerson(input, personShape(locked));
    const { rows } = await client.query(
      `UPDATE family_persons SET first_name=$2, last_name=$3, patronymic=$4, maiden_name=$5, gender=$6, birth_date=$7,
         birth_place=$8, is_alive=$9, death_date=$10, death_place=$11, occupation=$12, bio=$13, contacts=$14,
         updated_by=$15, updated_at=NOW(), family_order=$16
       WHERE id=$1 RETURNING *`,
      [
        personId,
        person.firstName,
        person.lastName,
        person.patronymic,
        person.maidenName,
        person.gender,
        person.birthDate,
        person.birthPlace,
        person.isAlive,
        person.deathDate,
        person.deathPlace,
        person.occupation,
        person.bio,
        JSON.stringify(person.contacts),
        ctx.userId,
        JSON.stringify(person.familyOrder || []),
      ]
    );
    await touchTree(client, locked.tree_id, ctx.userId);
    return personShape(rows[0]);
  });
}

export async function deletePerson(ctx, personId) {
  const row = await requirePerson(ctx, personId, LEVEL.edit);
  await withTransaction(async (client) => {
    await client.query(`UPDATE family_trees SET home_person_id = NULL WHERE home_person_id = $1`, [personId]);
    // Views centred on this person move to a close relative (or the tree's home person),
    // so links built on them do not turn empty.
    const near = (
      await client.query(
        `SELECT id FROM (
           SELECT parent_id AS id, 1 AS o FROM family_parents WHERE child_id = $1
           UNION ALL SELECT CASE WHEN partner_a = $1 THEN partner_b ELSE partner_a END, 2 FROM family_unions WHERE partner_a = $1 OR partner_b = $1
           UNION ALL SELECT child_id, 3 FROM family_parents WHERE parent_id = $1
           UNION ALL SELECT home_person_id, 4 FROM family_trees WHERE id = $2 AND home_person_id IS NOT NULL
         ) x ORDER BY o LIMIT 1`,
        [personId, row.tree_id]
      )
    ).rows[0]?.id;
    if (near) {
      await client.query(
        `UPDATE family_views SET filter = jsonb_set(filter, '{focus}', to_jsonb($2::int)) WHERE tree_id = $3 AND (filter->>'focus')::int = $1`,
        [personId, near, row.tree_id]
      );
    }
    await client.query(
      `UPDATE family_persons SET family_order = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(family_order) e WHERE e <> to_jsonb($1::int)), '[]'::jsonb)
       WHERE tree_id = $2 AND family_order @> to_jsonb(ARRAY[$1::int])`,
      [personId, row.tree_id]
    );
    await client.query(`DELETE FROM family_persons WHERE id = $1`, [personId]);
    await touchTree(client, row.tree_id, ctx.userId);
  });
  await removeBlob(row.photo_key);
  await removeBlob(row.photo_full_key);
}

// ── Links ───────────────────────────────────────────────────────────────────

export async function addParent(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const childId = Number(input.childId);
  const parentId = Number(input.parentId);
  return withTransaction(async (client) => {
    await samePersonTree(client, treeId, [childId, parentId]);
    const row = await linkParent(client, treeId, childId, parentId, input.kind);
    await touchTree(client, treeId, ctx.userId);
    return parentShape(row);
  });
}

async function linkRow(table, id) {
  const row = (await query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  return row;
}

export async function updateParent(ctx, linkId, input = {}) {
  const row = await linkRow('family_parents', linkId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  const kind = PARENT_KINDS.includes(input.kind) ? input.kind : row.kind;
  await query(`UPDATE family_parents SET kind = $2 WHERE id = $1`, [linkId, kind]);
}

export async function removeParent(ctx, linkId) {
  const row = await linkRow('family_parents', linkId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM family_parents WHERE id = $1`, [linkId]);
    await touchTree(client, row.tree_id, ctx.userId);
  });
}

export async function addUnion(ctx, treeId, input = {}) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const a = Number(input.partnerA);
  const b = Number(input.partnerB);
  return withTransaction(async (client) => {
    await samePersonTree(client, treeId, [a, b]);
    const row = await linkUnion(client, treeId, a, b, input);
    await touchTree(client, treeId, ctx.userId);
    return unionShape(row);
  });
}

export async function updateUnion(ctx, unionId, input = {}) {
  const row = await linkRow('family_unions', unionId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  const union = cleanUnion(input, { status: row.status, startDate: row.start_date, endDate: row.end_date });
  await query(`UPDATE family_unions SET status = $2, start_date = $3, end_date = $4 WHERE id = $1`, [
    unionId,
    union.status,
    union.startDate,
    union.endDate,
  ]);
}

export async function removeUnion(ctx, unionId) {
  const row = await linkRow('family_unions', unionId);
  await requireTree(ctx, row.tree_id, LEVEL.edit);
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM family_unions WHERE id = $1`, [unionId]);
    await touchTree(client, row.tree_id, ctx.userId);
  });
}

// ── Photos ──────────────────────────────────────────────────────────────────

function runUpload(upload, req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') reject(httpError(413, 'The photo is too large', 'FILE_TOO_LARGE'));
      else if (err) reject(err.statusCode ? err : httpError(400, err.message));
      else resolve();
    });
  });
}

/**
 * Receives a portrait: `photo` (the square shown everywhere) and optionally
 * `full` (the whole picture, for viewing it large). Both are checked by
 * content; on any problem nothing is kept.
 */
export async function receivePhotos(req, res) {
  const settings = await familySettings();
  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, file, cb) => {
        try {
          file.storageKey = await newStorageKey(extOf(originalName(file)), 'family');
          cb(null, storagePath(file.storageKey).replace(/[^/\\]+$/, ''));
        } catch (err) {
          cb(err);
        }
      },
      filename: (_req, file, cb) => cb(null, file.storageKey.split('/').pop()),
    }),
    limits: { fileSize: settings.maxPhotoMb * 1024 * 1024, files: 2, fields: 4 },
    fileFilter: (_req, file, cb) => {
      const ext = extOf(originalName(file));
      if (!PHOTO_EXT.includes(ext)) cb(httpError(400, 'Use a JPG, PNG or WebP picture', 'FILE_TYPE'));
      else cb(null, true);
    },
  }).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'full', maxCount: 1 },
  ]);
  await runUpload(upload, req, res);
  const main = req.files?.photo?.[0];
  const full = req.files?.full?.[0] || null;
  const drop = async () => {
    if (main) await removeBlob(main.storageKey);
    if (full) await removeBlob(full.storageKey);
  };
  if (!main) {
    await drop();
    throw httpError(400, 'No photo received', 'NO_FILE');
  }
  try {
    await verifyContent(main.path, extOf(originalName(main)));
    if (full) await verifyContent(full.path, extOf(originalName(full)));
  } catch (err) {
    await drop();
    throw err;
  }
  return { key: main.storageKey, ext: extOf(originalName(main)), fullKey: full?.storageKey || null, drop };
}

export async function uploadPhoto(ctx, personId, req, res) {
  const row = await requirePerson(ctx, personId, LEVEL.edit);
  const got = await receivePhotos(req, res);
  const { rows } = await query(
    `UPDATE family_persons SET photo_key = $2, photo_ext = $3, photo_full_key = $5, photo_version = photo_version + 1, updated_at = NOW(), updated_by = $4
     WHERE id = $1 RETURNING *`,
    [personId, got.key, got.ext, ctx.userId, got.fullKey]
  );
  await removeBlob(row.photo_key);
  await removeBlob(row.photo_full_key);
  return personShape(rows[0]);
}

export async function deletePhoto(ctx, personId) {
  const row = await requirePerson(ctx, personId, LEVEL.edit);
  const { rows } = await query(
    `UPDATE family_persons SET photo_key = NULL, photo_ext = NULL, photo_full_key = NULL, photo_version = photo_version + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [personId]
  );
  await removeBlob(row.photo_key);
  await removeBlob(row.photo_full_key);
  return personShape(rows[0]);
}

/** `size`: 'full' for the whole picture when there is one, else the square portrait. */
export async function sendPersonPhoto(res, row, size) {
  if (!row.photo_key) throw httpError(404, 'No photo', 'NOT_FOUND');
  const key = size === 'full' && row.photo_full_key ? row.photo_full_key : row.photo_key;
  const ext = extOf(key) || row.photo_ext;
  await sendBlob(res, storagePath(key), { name: `photo.${ext}`, ext });
}

export async function sendPhoto(ctx, personId, res, size) {
  const row = await requirePerson(ctx, personId, LEVEL.view);
  await sendPersonPhoto(res, row, size);
}

// ── Access list ─────────────────────────────────────────────────────────────

export async function getAccess(ctx, treeId) {
  await requireTree(ctx, treeId, LEVEL.manage);
  return { entries: await readAcl(ACL, treeId) };
}

export async function setAccess(ctx, treeId, entries) {
  await requireTree(ctx, treeId, LEVEL.manage);
  await withTransaction((client) => writeAcl(client, ACL, treeId, entries, ctx));
}

export const listSubjects = aclSubjects;

// ── Export / import ─────────────────────────────────────────────────────────

export async function exportTree(ctx, treeId) {
  const { tree, persons, parents, unions } = await getTree(ctx, treeId);
  return {
    format: 'family-tree-v1',
    exportedAt: new Date().toISOString(),
    tree: { name: tree.name, description: tree.description, homePersonId: tree.homePersonId, showUnknownParents: tree.showUnknownParents },
    persons: persons.map(({ photoUrl, updatedAt, ...person }) => ({ ...person, hasPhoto: Boolean(photoUrl) })),
    parents: parents.map(({ id, ...link }) => link),
    unions: unions.map(({ id, ...union }) => union),
  };
}

const GEDCOM_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function gedcomDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-');
  return [d ? Number(d) : null, m ? GEDCOM_MONTHS[Number(m) - 1] : null, y].filter(Boolean).join(' ');
}

/**
 * GEDCOM 5.5.1: one INDI per person, one FAM per couple and per set of
 * parents without a recorded couple, so children land in the right family.
 */
export async function exportGedcom(ctx, treeId) {
  const { tree, persons, parents, unions } = await getTree(ctx, treeId);
  const ref = new Map(persons.map((person, index) => [person.id, `@I${index + 1}@`]));
  const families = new Map();
  const key = (a, b) => [a, b].filter(Boolean).sort((x, y) => x - y).join('-');
  for (const union of unions) families.set(key(union.partnerA, union.partnerB), { a: union.partnerA, b: union.partnerB, union, children: [] });
  const byChild = new Map();
  for (const link of parents) byChild.set(link.childId, [...(byChild.get(link.childId) || []), link.parentId]);
  for (const [childId, list] of byChild) {
    const k = key(list[0], list[1]);
    if (!families.has(k)) families.set(k, { a: list[0], b: list[1] || null, union: null, children: [] });
    families.get(k).children.push(childId);
  }
  const famRef = new Map([...families.keys()].map((k, index) => [k, `@F${index + 1}@`]));
  const lines = ['0 HEAD', '1 SOUR FAMILY', '2 NAME Family tree', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
  lines.push(`1 NOTE ${tree.name}`);
  for (const person of persons) {
    lines.push(`0 ${ref.get(person.id)} INDI`);
    lines.push(`1 NAME ${[person.firstName, person.patronymic].filter(Boolean).join(' ')} /${person.lastName}/`);
    if (person.firstName) lines.push(`2 GIVN ${person.firstName}`);
    if (person.lastName) lines.push(`2 SURN ${person.lastName}`);
    if (person.maidenName) lines.push(`2 _MARNM ${person.maidenName}`);
    lines.push(`1 SEX ${person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : 'U'}`);
    if (person.birthDate || person.birthPlace) {
      lines.push('1 BIRT');
      if (person.birthDate) lines.push(`2 DATE ${gedcomDate(person.birthDate)}`);
      if (person.birthPlace) lines.push(`2 PLAC ${person.birthPlace}`);
    }
    if (!person.isAlive) {
      lines.push('1 DEAT Y');
      if (person.deathDate) lines.push(`2 DATE ${gedcomDate(person.deathDate)}`);
      if (person.deathPlace) lines.push(`2 PLAC ${person.deathPlace}`);
    }
    if (person.occupation) lines.push(`1 OCCU ${person.occupation}`);
    for (const [k, family] of families) {
      if (family.children.includes(person.id)) lines.push(`1 FAMC ${famRef.get(k)}`);
      if (family.a === person.id || family.b === person.id) lines.push(`1 FAMS ${famRef.get(k)}`);
    }
    if (person.bio) person.bio.split(/\r?\n/).forEach((line, index) => lines.push(`${index ? '2 CONT' : '1 NOTE'} ${line}`));
  }
  const byId = new Map(persons.map((person) => [person.id, person]));
  for (const [k, family] of families) {
    lines.push(`0 ${famRef.get(k)} FAM`);
    const partners = [family.a, family.b].filter(Boolean).map((id) => byId.get(id));
    const husband = partners.find((p) => p.gender === 'male') || partners[0];
    const wife = partners.find((p) => p !== husband);
    if (husband) lines.push(`1 HUSB ${ref.get(husband.id)}`);
    if (wife) lines.push(`1 WIFE ${ref.get(wife.id)}`);
    if (family.union?.startDate) lines.push('1 MARR', `2 DATE ${gedcomDate(family.union.startDate)}`);
    if (family.union && ['divorced', 'separated'].includes(family.union.status)) lines.push('1 DIV Y');
    for (const child of family.children) lines.push(`1 CHIL ${ref.get(child)}`);
  }
  lines.push('0 TRLR');
  return { name: tree.name, text: `${lines.join('\r\n')}\r\n` };
}

/**
 * Imports people and links into an existing tree from a family-tree-v1 export
 * or from the old ftree format ({ nodes, relations }). Ids are remapped.
 */
export async function importInto(ctx, treeId, data) {
  await requireTree(ctx, treeId, LEVEL.edit);
  const legacy = Array.isArray(data?.nodes);
  const people = legacy ? data.nodes : data?.persons;
  if (!Array.isArray(people)) throw httpError(400, 'Unknown file format', 'BAD_FORMAT');
  if (people.length > 5000) throw httpError(400, 'Too many people in one file', 'TOO_LARGE');
  return withTransaction(async (client) => {
    const idMap = new Map();
    const orders = [];
    let skipped = 0;
    for (const raw of people) {
      // Imports are lenient: a date that does not parse is dropped, not the person.
      const lenient = (value) => {
        try {
          return cleanDate(value);
        } catch {
          return null;
        }
      };
      let person;
      try {
        person = cleanPerson({
          ...raw,
          birthDate: lenient(raw.birthDate),
          deathDate: lenient(raw.deathDate),
          isAlive: raw.isAlive ?? !(raw.deathDate || raw.deathPlace),
        });
      } catch {
        skipped += 1;
        continue;
      }
      const row = await insertPerson(client, treeId, { ...person, familyOrder: [] }, ctx.userId);
      if (raw.id !== undefined) {
        await client.query(`UPDATE family_persons SET legacy_id = $2 WHERE id = $1`, [row.id, String(raw.id).slice(0, 64)]);
        idMap.set(String(raw.id), row.id);
      }
      if (person.familyOrder.length) orders.push([row.id, person.familyOrder]);
    }
    // Family orders name partners by their ids in the source file.
    for (const [newId, order] of orders) {
      const mapped = order.map((v) => (v === 0 ? 0 : idMap.get(String(v)))).filter((v) => v !== undefined);
      await client.query(`UPDATE family_persons SET family_order = $2 WHERE id = $1`, [newId, JSON.stringify(mapped)]);
    }
    const parentLinks = legacy
      ? (data.relations || []).filter((r) => r.type === 'parent-child').map((r) => ({ parentId: r.from, childId: r.to }))
      : data.parents || [];
    const couples = legacy
      ? (data.relations || []).filter((r) => r.type === 'spouse').map((r) => ({ partnerA: r.from, partnerB: r.to, status: 'married' }))
      : data.unions || [];
    let links = 0;
    const problems = [];
    for (const link of parentLinks) {
      const childId = idMap.get(String(link.childId));
      const parentId = idMap.get(String(link.parentId));
      if (!childId || !parentId) continue;
      try {
        await client.query('SAVEPOINT link');
        await linkParent(client, treeId, childId, parentId, link.kind);
        await client.query('RELEASE SAVEPOINT link');
        links += 1;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT link');
        problems.push(err.code || 'ERROR');
      }
    }
    for (const couple of couples) {
      const a = idMap.get(String(couple.partnerA));
      const b = idMap.get(String(couple.partnerB));
      if (!a || !b) continue;
      try {
        await client.query('SAVEPOINT link');
        await linkUnion(client, treeId, a, b, couple);
        await client.query('RELEASE SAVEPOINT link');
        links += 1;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT link');
        problems.push(err.code || 'ERROR');
      }
    }
    await touchTree(client, treeId, ctx.userId);
    return { persons: idMap.size, links, skipped, problems: problems.length };
  });
}

export { fullName };
