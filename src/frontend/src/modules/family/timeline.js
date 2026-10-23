/*
 * Timeline ("lifelines") of a tree: one row per person, read top to bottom
 * like an outline of the family — a person, their partners right below,
 * then their children (indented), and so on. Each row is a bar from birth to
 * death (or today) on a shared axis of years; a child's branch drops from the
 * parent's bar at the child's year of birth.
 *
 * Couples come in the order of their first shared child; a couple without a
 * recorded date is marked at that child's birth.
 *
 * Unknown years are estimated from relatives (about a generation apart) and
 * marked as estimated, so everyone still gets a place on the axis.
 */

export const GENERATION_YEARS = 28;
const LIFESPAN = 75;

const yearOf = (value) => (value ? Number(String(value).slice(0, 4)) : null);

export function buildTimeline(persons, parents, unions, now = new Date().getFullYear()) {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const parentsOf = new Map();
  const childrenOf = new Map();
  for (const l of parents) {
    if (!byId.has(l.childId) || !byId.has(l.parentId)) continue;
    if (!parentsOf.has(l.childId)) parentsOf.set(l.childId, []);
    parentsOf.get(l.childId).push(l.parentId);
    if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, []);
    childrenOf.get(l.parentId).push(l.childId);
  }
  const partnersOf = new Map();
  const unionOf = new Map();
  for (const u of unions) {
    if (!byId.has(u.partnerA) || !byId.has(u.partnerB)) continue;
    for (const [a, b] of [
      [u.partnerA, u.partnerB],
      [u.partnerB, u.partnerA],
    ]) {
      if (!partnersOf.has(a)) partnersOf.set(a, []);
      partnersOf.get(a).push(b);
      unionOf.set(`${a}:${b}`, u);
    }
  }
  // Co-parents without a recorded union are partners for the outline too.
  for (const list of parentsOf.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list;
    if ((partnersOf.get(a) || []).includes(b)) continue;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      if (!partnersOf.has(x)) partnersOf.set(x, []);
      partnersOf.get(x).push(y);
    }
  }

  // Birth years: known, else estimated from relatives (repeat to propagate).
  const born = new Map();
  const estimated = new Set();
  for (const p of persons) if (yearOf(p.birthDate)) born.set(p.id, yearOf(p.birthDate));
  for (let round = 0; round < 6; round += 1) {
    for (const p of persons) {
      if (born.has(p.id)) continue;
      const guesses = [];
      for (const c of childrenOf.get(p.id) || []) if (born.has(c)) guesses.push(born.get(c) - GENERATION_YEARS);
      for (const q of parentsOf.get(p.id) || []) if (born.has(q)) guesses.push(born.get(q) + GENERATION_YEARS);
      for (const q of partnersOf.get(p.id) || []) if (born.has(q)) guesses.push(born.get(q));
      const died = yearOf(p.deathDate);
      if (died) guesses.push(died - LIFESPAN + 5);
      if (guesses.length) {
        born.set(p.id, Math.round(guesses.reduce((s, v) => s + v, 0) / guesses.length));
        estimated.add(p.id);
      }
    }
  }
  for (const p of persons) {
    if (!born.has(p.id)) {
      born.set(p.id, now - 40);
      estimated.add(p.id);
    }
  }

  // Outline order: a person, then each couple in the order of its wedding
  // (or, when the date is unknown, of its first shared child) — the partner's row followed by that couple's children —
  // then children with no known second parent.
  const rows = [];
  const placed = new Set();
  const byBirth = (a, b) => born.get(a) - born.get(b) || a - b;
  const kidsOf = (id) => childrenOf.get(id) || [];
  const visit = (id, depth) => {
    if (placed.has(id)) return;
    placed.add(id);
    rows.push({ id, depth, partnerOf: null });
    const own = new Set(kidsOf(id));
    const groups = (partnersOf.get(id) || []).map((partner) => {
      const shared = kidsOf(partner).filter((k) => own.has(k)).sort(byBirth);
      const theirs = kidsOf(partner).filter((k) => !own.has(k)).sort(byBirth);
      const wedding = yearOf(unionOf.get(`${id}:${partner}`)?.startDate);
      return { partner, shared, theirs, first: wedding || (shared.length ? born.get(shared[0]) : Infinity) };
    });
    groups.sort((a, b) => a.first - b.first || byBirth(a.partner, b.partner));
    const inCouples = new Set(groups.flatMap((g) => g.shared));
    for (const g of groups) {
      // A partner whose own parents are in the tree is shown under them;
      // their shared children still follow here.
      const showPartner = !placed.has(g.partner) && !(parentsOf.has(g.partner) && !parentsOf.has(id));
      if (showPartner) {
        placed.add(g.partner);
        rows.push({ id: g.partner, depth, partnerOf: id });
      }
      for (const kid of g.shared) visit(kid, depth + 1);
      if (showPartner) for (const kid of g.theirs) visit(kid, depth + 1);
    }
    for (const kid of [...own].filter((k) => !inCouples.has(k)).sort(byBirth)) visit(kid, depth + 1);
  };
  const roots = persons
    .map((p) => p.id)
    .filter((id) => !parentsOf.has(id) && !(partnersOf.get(id) || []).some((q) => parentsOf.has(q)))
    .sort(byBirth);
  for (const id of roots) visit(id, 0);
  for (const id of [...persons.map((p) => p.id)].sort(byBirth)) visit(id, 0);

  const rowOf = new Map(rows.map((r, i) => [r.id, i]));
  const life = rows.map((row) => {
    const p = byId.get(row.id);
    const from = born.get(row.id);
    const died = yearOf(p.deathDate);
    const open = !p.isAlive && !died;
    const to = p.isAlive ? now : died || Math.min(now, from + LIFESPAN);
    return { ...row, person: p, from, to: Math.max(to, from + 1), estimated: estimated.has(row.id), openEnd: open };
  });

  const branches = [];
  for (const [childId, list] of parentsOf) {
    const childRow = rowOf.get(childId);
    if (childRow === undefined) continue;
    const parentRows = list.map((id) => rowOf.get(id)).filter((r) => r !== undefined);
    if (!parentRows.length) continue;
    branches.push({ childId, parents: list, fromRow: Math.min(...parentRows), toRow: childRow, year: born.get(childId), estimated: estimated.has(childId) });
  }

  const couples = [];
  for (const row of rows) {
    if (row.partnerOf === null) continue;
    const union = unionOf.get(`${row.partnerOf}:${row.id}`) || null;
    // Without a recorded date, the couple is marked at their first shared child.
    const shared = kidsOf(row.partnerOf).filter((k) => kidsOf(row.id).includes(k));
    const firstChild = shared.length ? Math.min(...shared.map((k) => born.get(k))) : null;
    const known = yearOf(union?.startDate);
    couples.push({ a: row.partnerOf, b: row.id, rowA: rowOf.get(row.partnerOf), rowB: rowOf.get(row.id), union, year: known || firstChild, estimated: !known });
  }

  const minYear = Math.floor((Math.min(...life.map((l) => l.from)) - 4) / 10) * 10;
  const maxYear = Math.ceil((now + 3) / 10) * 10;
  return { rows: life, branches, couples, minYear, maxYear, now, rowOf };
}
