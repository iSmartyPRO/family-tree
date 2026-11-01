import { query } from '../../config/database.js';
import { ensureAclTable } from '../shared/acl.js';

/*
 * Family tree storage.
 *
 *   family_trees    a family tree (name, description, the person it opens on)
 *   family_tree_acl who may view / edit / manage a tree (shared/acl.js)
 *   family_persons  people of a tree: names, dates, places, contacts, photo
 *   family_parents  child → parent links (at most two parents per child)
 *   family_unions   couples: married, partners, divorced
 *   family_shares   public links to the whole tree or a view (password, expiry,
 *                   view / suggest / edit)
 *   family_me       «this is me»: which person a user is, per tree
 *   family_views    saved filters (focus, side, depth…) over one tree
 *   family_suggestions  changes proposed through links, waiting for review
 *
 * Couples and families are not drawn from stored coordinates: the tree is
 * laid out from these links every time (frontend modules/family/layout.js).
 */

export async function ensureFamilySchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS family_trees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      home_person_id INTEGER,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await ensureAclTable('family_tree_acl', 'family_trees');
  // Draw a «not known» card for a missing second parent (off: children hang from one parent).
  await query(`ALTER TABLE family_trees ADD COLUMN IF NOT EXISTS show_unknown_parents BOOLEAN NOT NULL DEFAULT TRUE`);

  await query(`
    CREATE TABLE IF NOT EXISTS family_persons (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      first_name VARCHAR(80) NOT NULL DEFAULT '',
      last_name VARCHAR(80) NOT NULL DEFAULT '',
      patronymic VARCHAR(80) NOT NULL DEFAULT '',
      maiden_name VARCHAR(80) NOT NULL DEFAULT '',
      gender VARCHAR(8) NOT NULL DEFAULT 'unknown',
      birth_date VARCHAR(10),
      birth_place VARCHAR(160) NOT NULL DEFAULT '',
      is_alive BOOLEAN NOT NULL DEFAULT TRUE,
      death_date VARCHAR(10),
      death_place VARCHAR(160) NOT NULL DEFAULT '',
      occupation VARCHAR(160) NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      contacts JSONB NOT NULL DEFAULT '{}'::jsonb,
      photo_key TEXT,
      photo_ext VARCHAR(8),
      photo_version INTEGER NOT NULL DEFAULT 0,
      legacy_id VARCHAR(64),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_persons_tree_idx ON family_persons (tree_id)`);
  // Manual order of a person's families: partner ids, 0 = «other parent unknown».
  await query(`ALTER TABLE family_persons ADD COLUMN IF NOT EXISTS family_order JSONB NOT NULL DEFAULT '[]'::jsonb`);
  // The uncropped picture behind the square portrait (for viewing it large).
  await query(`ALTER TABLE family_persons ADD COLUMN IF NOT EXISTS photo_full_key TEXT`);

  await query(`
    CREATE TABLE IF NOT EXISTS family_parents (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      child_id INTEGER NOT NULL REFERENCES family_persons(id) ON DELETE CASCADE,
      parent_id INTEGER NOT NULL REFERENCES family_persons(id) ON DELETE CASCADE,
      kind VARCHAR(12) NOT NULL DEFAULT 'birth',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (child_id, parent_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_parents_tree_idx ON family_parents (tree_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS family_unions (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      partner_a INTEGER NOT NULL REFERENCES family_persons(id) ON DELETE CASCADE,
      partner_b INTEGER NOT NULL REFERENCES family_persons(id) ON DELETE CASCADE,
      status VARCHAR(12) NOT NULL DEFAULT 'married',
      start_date VARCHAR(10),
      end_date VARCHAR(10),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_unions_tree_idx ON family_unions (tree_id)`);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS family_unions_pair_key ON family_unions (LEAST(partner_a, partner_b), GREATEST(partner_a, partner_b))`
  );

  await query(`
    CREATE TABLE IF NOT EXISTS family_shares (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      token VARCHAR(40) NOT NULL UNIQUE,
      title VARCHAR(120),
      password_hash TEXT,
      expires_at TIMESTAMPTZ,
      version INTEGER NOT NULL DEFAULT 1,
      view_count INTEGER NOT NULL DEFAULT 0,
      last_viewed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_shares_tree_idx ON family_shares (tree_id)`);

  await query(`
    CREATE TABLE IF NOT EXISTS family_me (
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES family_persons(id) ON DELETE CASCADE,
      PRIMARY KEY (tree_id, user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS family_views (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      filter JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_views_tree_idx ON family_views (tree_id)`);

  // A link shows the whole tree or one view; visitors may only look, propose
  // changes for review, or edit the people of that view directly.
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS view_id INTEGER REFERENCES family_views(id) ON DELETE CASCADE`);
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS access VARCHAR(10) NOT NULL DEFAULT 'view'`);
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS allow_clone BOOLEAN NOT NULL DEFAULT TRUE`);

  await query(`
    CREATE TABLE IF NOT EXISTS family_suggestions (
      id SERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      share_id INTEGER REFERENCES family_shares(id) ON DELETE SET NULL,
      person_id INTEGER REFERENCES family_persons(id) ON DELETE CASCADE,
      kind VARCHAR(16) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      photo_key TEXT,
      photo_ext VARCHAR(8),
      author_name VARCHAR(120) NOT NULL DEFAULT '',
      author_note TEXT NOT NULL DEFAULT '',
      status VARCHAR(10) NOT NULL DEFAULT 'pending',
      result_person_id INTEGER REFERENCES family_persons(id) ON DELETE SET NULL,
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_suggestions_tree_idx ON family_suggestions (tree_id, status, created_at DESC)`);
  await query(`ALTER TABLE family_suggestions ADD COLUMN IF NOT EXISTS author_phone VARCHAR(40) NOT NULL DEFAULT ''`);
  await query(`ALTER TABLE family_suggestions ADD COLUMN IF NOT EXISTS photo_full_key TEXT`);

  // Visitors of a link may be asked who they are (name, phone) before the tree opens.
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS ask_name BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS ask_phone VARCHAR(10) NOT NULL DEFAULT 'off'`);
  // How the link looks: colour scheme (default or forced) and the helper robot.
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS theme VARCHAR(8) NOT NULL DEFAULT 'system'`);
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS theme_locked BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE family_shares ADD COLUMN IF NOT EXISTS assistant BOOLEAN NOT NULL DEFAULT FALSE`);

  // Who did what in a tree: owners and editors (user_id) or link visitors
  // (share_id + the name and phone they gave).
  await query(`
    CREATE TABLE IF NOT EXISTS family_log (
      id BIGSERIAL PRIMARY KEY,
      tree_id INTEGER NOT NULL REFERENCES family_trees(id) ON DELETE CASCADE,
      share_id INTEGER REFERENCES family_shares(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      visitor_name VARCHAR(120) NOT NULL DEFAULT '',
      visitor_phone VARCHAR(40) NOT NULL DEFAULT '',
      action VARCHAR(40) NOT NULL,
      person_id INTEGER,
      person_name VARCHAR(250) NOT NULL DEFAULT '',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip VARCHAR(64) NOT NULL DEFAULT '',
      user_agent VARCHAR(300) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS family_log_tree_idx ON family_log (tree_id, created_at DESC)`);
}
