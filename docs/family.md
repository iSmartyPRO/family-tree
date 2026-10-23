# Family tree

Module `family`: family trees with an automatic layout and a timeline of lives.

| | |
|---|---|
| UI | `/app/family` (list), `/app/family/t/:id` (a tree; `?p=<personId>` selects, `?v=timeline` switches the view), `/t/:token` (public link) |
| API | `/api/app/family/…` (signed in), `/api/t/…` (public links) |
| Permission | `family.admin` — every tree and the module settings |
| Settings | `maxPhotoMb`, `publicLinks`, `requireSharePassword`, `maxShareDays` |
| Backend | `src/backend/modules/family/` — `schema.js`, `rules.js` (pure checks), `service.js`, `shares.js`, `routes.js` |
| Frontend | `src/frontend/src/modules/family/` — `layout.js` (tree layout), `timeline.js` (lifelines), `components/`, `pages/` |

## Data

| Table | Holds |
|---|---|
| `family_trees` | name, description, `home_person_id` (the person the tree opens on) |
| `family_tree_acl` | access per tree (`shared/acl.js`: view / edit / manage); the creator gets manage |
| `family_persons` | names, gender, partial dates (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`), places, occupation, story, `contacts` (JSONB), photo blob key |
| `family_parents` | child → parent (`kind`: birth, adoptive, step, foster); at most two parents, no cycles |
| `family_unions` | couples: `status` (married, partners, engaged, divorced, separated, widowed), `start_date`, `end_date` |
| `family_shares` | public links: random token, bcrypt password, expiry, `version` (bumped on password change / revoke) |

Coordinates are never stored. The rules in `rules.js` (dates, two parents, cycles, couples) are
covered by `test/family.test.js`.

## Tree layout (`layout.js`)

1. **Couples** — recorded unions plus *implied* ones: two parents of the same child with no union.
2. **Generations** — a child below its parents, partners in one row; parentless people who married
   in are pulled down next to their children.
3. **Units** — partners side by side (a chain for remarriages).
4. **Subtrees** — every unit hangs under one parent unit (biggest families claim first); subtrees are
   packed by their per-row contours (Reingold–Tilford style), parents centred over their children.
5. **In-laws** — parents whose children all married into another family go to the nearest free spot
   above those children.
6. **Lines** — couple: horizontal line between the cards; children: from the middle of that line down to
   a bus, along it, down to each child; single parent: from the bottom of the card. Buses that overlap in
   a row get separate lanes.

## Timeline (`timeline.js`)

Rows form an outline: a person, then each couple in the order of its wedding (or, without a date, of its
first shared child) — the partner's row followed by that couple's children, indented — then children with
no known second parent. Bars run from birth to death (or today); a child's branch drops from the parent's
bar at the child's birth year; the couple mark sits at the wedding year or, dotted, at the first shared
child's birth. Unknown birth years are estimated from relatives (±28 years per generation) and drawn faded.

## Import

`POST /api/app/family/trees/:id/import` with `{ data }` accepts this module's JSON export
(`format: family-tree-v1`) or the old ftree tree document (`{ nodes, relations }`), remaps ids, keeps
`legacy_id`, and is lenient with dates (a bad date is dropped, not the person).

## «Me», views, links, suggestions, cloning

| Table | Holds |
|---|---|
| `family_me` | `(tree_id, user_id) → person_id`: who a user is in a tree; kinship labels (`frontend …/kinship.js`) and default focus |
| `family_views` | saved filters: `{ focus, side, ancestors, descendants, collateral, partners }` |
| `family_shares.view_id / access / allow_clone` | a link shows a view (or the whole tree); visitors may `view`, `suggest` (reviewed) or `edit` (applied at once as the link's author, within the view) |
| `family_suggestions` | proposals from links: `update` (changed fields only), `photo`, `relative` (`{ person, relation }`); status pending → accepted / rejected, or `applied` for edit links |

`selection.js` (pure, tested) decides who a filter shows: the chosen side only for the first step up (the other
parent stays as a co-parent), ancestors and descendants to the depth, side branches `collateral` generations
down from every ancestor, then partners and co-parents. The same function serves the screen
(`POST /trees/:id/select`), public links and cloning (`views.js → cloneGraph`: people, links and photo files are
copied into a new tree owned by the caller; contacts are kept only when cloning one's own tree).
Public endpoints: `POST /api/t/:token/suggest`, `POST /api/t/:token/persons/:id/photo` (rate-limited, 40/hour per
address and link).
