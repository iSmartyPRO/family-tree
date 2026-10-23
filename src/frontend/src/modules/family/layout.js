/*
 * Family tree layout: positions and connector lines computed from the links
 * alone (no stored coordinates).
 *
 *   1. Couples: recorded unions plus "implied" ones (two parents of the same
 *      child who have no recorded union) — they are drawn as a couple too.
 *   2. Generations: a child is below its parents, partners share a row;
 *      people who married in are pulled down next to their family.
 *   3. Units: partners side by side form one unit (a chain for remarriages).
 *   4. Trees: every unit hangs under one parent unit (the biggest family
 *      claims first); subtrees are packed tidily by their row contours
 *      (Reingold–Tilford style) and parents sit centred over their children.
 *   5. In-laws: parents whose children all married into another family are
 *      placed in the nearest free spot above those children.
 *   6. Lines: a couple gets a horizontal line between the partners; their
 *      children hang from its middle: down to a bus, along it, down to each
 *      child. A single parent's children hang from the bottom of the card.
 *
 * Pure functions only — used by the canvas and by the public view.
 */

export const CARD_W = 148;
export const CARD_H = 64;
export const PARTNER_GAP = 36;
export const SIBLING_GAP = 20;
export const FAMILY_GAP = 48;
export const ROW_GAP = 88;
export const ROW_H = CARD_H + ROW_GAP;

const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function birthKey(person) {
  return person?.birthDate || '9999';
}

/** Couples and families (parent set → children) from the raw links. */
export function buildFamilies(persons, parents, unions) {
  const ids = new Set(persons.map((p) => p.id));
  const parentsOf = new Map();
  const childrenOf = new Map();
  for (const link of parents) {
    if (!ids.has(link.childId) || !ids.has(link.parentId)) continue;
    if (!parentsOf.has(link.childId)) parentsOf.set(link.childId, []);
    parentsOf.get(link.childId).push(link.parentId);
    if (!childrenOf.has(link.parentId)) childrenOf.set(link.parentId, []);
    childrenOf.get(link.parentId).push(link.childId);
  }
  const couples = new Map();
  for (const union of unions) {
    if (!ids.has(union.partnerA) || !ids.has(union.partnerB)) continue;
    couples.set(pairKey(union.partnerA, union.partnerB), { a: union.partnerA, b: union.partnerB, union, implied: false });
  }
  const families = new Map();
  for (const [childId, list] of parentsOf) {
    const sorted = [...list].sort((x, y) => x - y);
    const key = sorted.length === 2 ? pairKey(sorted[0], sorted[1]) : `${sorted[0]}`;
    if (sorted.length === 2 && !couples.has(key)) couples.set(key, { a: sorted[0], b: sorted[1], union: null, implied: true });
    if (!families.has(key)) families.set(key, { key, parents: sorted, children: [] });
    families.get(key).children.push(childId);
  }
  const partnersOf = new Map();
  for (const couple of couples.values()) {
    for (const [x, y] of [
      [couple.a, couple.b],
      [couple.b, couple.a],
    ]) {
      if (!partnersOf.has(x)) partnersOf.set(x, []);
      partnersOf.get(x).push(y);
    }
  }
  return { parentsOf, childrenOf, couples, families, partnersOf };
}

/** Generation (row) of every person. */
export function assignGenerations(persons, graph) {
  const parentsOf = graph.genParentsOf || graph.parentsOf;
  const childrenOf = graph.genChildrenOf || graph.childrenOf;
  const partnersOf = graph.rowmates || graph.partnersOf;
  const gen = new Map(persons.map((p) => [p.id, 0]));
  const limit = persons.length * 4 + 10;
  const settle = () => {
    for (let round = 0; round < limit; round += 1) {
      let changed = false;
      for (const [child, list] of parentsOf) {
        for (const parent of list) {
          if (gen.get(child) < gen.get(parent) + 1) {
            gen.set(child, gen.get(parent) + 1);
            changed = true;
          }
        }
      }
      for (const [person, list] of partnersOf) {
        for (const partner of list) {
          const g = Math.max(gen.get(person), gen.get(partner));
          if (gen.get(person) !== g || gen.get(partner) !== g) {
            gen.set(person, g);
            gen.set(partner, g);
            changed = true;
          }
        }
      }
      if (!changed) return;
    }
  };
  settle();
  // A person's next family goes below everything that grew from the
  // previous one (children, grandchildren…), so each family is one block.
  const continuation = graph.continuation || new Map();
  const deepest = (from, skip) => {
    let max = gen.get(from);
    const seen = new Set([from]);
    const stack = [...(childrenOf.get(from) || []).filter((c) => c !== skip)];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      max = Math.max(max, gen.get(id));
      for (const next of [...(childrenOf.get(id) || []), ...(partnersOf.get(id) || [])]) stack.push(next);
    }
    return max;
  };
  const sinkContinuations = () => {
    let moved = false;
    for (const [from, to] of continuation) {
      const floor = deepest(from, to) + 1;
      if (gen.get(to) < floor) {
        gen.set(to, floor);
        moved = true;
      }
    }
    return moved;
  };
  for (let round = 0; round < 12 && sinkContinuations(); round += 1) settle();
  // People without parents in the tree (they married in) come down to sit
  // right above their children instead of floating at the top.
  for (let round = 0; round < 6; round += 1) {
    let moved = false;
    const seen = new Set();
    for (const person of persons) {
      if (seen.has(person.id)) continue;
      // The person and everyone joined to them by couples form one block.
      const block = [];
      const stack = [person.id];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        block.push(id);
        for (const partner of partnersOf.get(id) || []) stack.push(partner);
      }
      if (block.some((id) => parentsOf.has(id))) continue;
      const kids = block.flatMap((id) => childrenOf.get(id) || []);
      if (!kids.length) continue;
      const target = Math.min(...kids.map((id) => gen.get(id))) - 1;
      if (target > gen.get(block[0])) {
        for (const id of block) gen.set(id, target);
        moved = true;
      }
    }
    if (!moved) break;
    settle();
  }
  const min = Math.min(0, ...gen.values());
  if (min < 0) for (const [id, g] of gen) gen.set(id, g - min);
  return gen;
}

/** Splits each row into units: partners side by side (a chain for remarriages). */
function buildUnits(persons, gen, graph, byId, anchored = () => false) {
  const partnersOf = graph.rowmates || graph.partnersOf;
  const couplesOf = graph.partnersOf;
  const side = graph.side || new Map();
  const unitOf = new Map();
  const units = [];
  const seen = new Set();
  for (const person of persons) {
    if (seen.has(person.id)) continue;
    const members = [];
    const stack = [person.id];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      members.push(id);
      for (const partner of partnersOf.get(id) || []) if (gen.get(partner) === gen.get(id)) stack.push(partner);
    }
    // Copies of a remarried person: one couple after another, in the order of
    // the marriages — «partner₁ · person», «person · partner₂», «person · partner₃».
    if (members.some((id) => side.has(id))) {
      // A married-in person's families side by side: walk the chain from the
      // card that is tied to the tree, partners before the next family.
      const inUnit = (id) => members.includes(id);
      const start = members.find(anchored) ?? members.find((id) => (partnersOf.get(id) || []).filter(inUnit).length === 1) ?? members[0];
      const order = [];
      const seen2 = new Set();
      const walk = (id) => {
        if (seen2.has(id)) return;
        seen2.add(id);
        order.push(id);
        for (const q of (couplesOf.get(id) || []).filter(inUnit)) walk(q);
        for (const q of (side.get(id) || []).filter(inUnit)) walk(q);
      };
      walk(start);
      for (const id of members) if (!seen2.has(id)) walk(id);
      members.length = 0;
      members.push(...order);
    } else if (members.length === 2) {
      const [x, y] = members;
      const gx = byId.get(x)?.gender;
      const gy = byId.get(y)?.gender;
      if (gx === 'female' && gy === 'male') members.reverse();
    } else if (members.length > 2) {
      members.sort((x, y) => (partnersOf.get(y)?.length || 0) - (partnersOf.get(x)?.length || 0));
      const [hub, ...rest] = members;
      members.length = 0;
      rest.forEach((id, index) => (index % 2 ? members.push(id) : members.unshift(id)));
      members.splice(Math.ceil(rest.length / 2), 0, hub);
    }
    const unit = { id: units.length, members, gen: gen.get(person.id), x: 0 };
    // Partners stand close; neighbouring couples of one remarried person a bit apart.
    unit.offsets = [];
    let at = 0;
    members.forEach((id, i) => {
      if (i) at += CARD_W + ((couplesOf.get(members[i - 1]) || []).includes(id) ? PARTNER_GAP : SIBLING_GAP + 6);
      unit.offsets.push(at);
    });
    unit.width = at + CARD_W;
    units.push(unit);
    for (const id of members) unitOf.set(id, unit);
  }
  return { units, unitOf };
}

/*
 * Several families of one person (remarriages, or children whose other
 * parent is not known) become separate couples on the drawing: the person's
 * card is repeated once per family — «Aigul — Askar», «Askar — Cholpon»,
 * «Askar — (not known)» — and each couple's children hang from that couple.
 * The first family (by wedding, else first child) keeps the real card and
 * hangs under the person's parents; each next family is a copy one row
 * lower, exactly under the previous card and joined to it by a «same person»
 * line, so a person with three marriages forms a column, not a long row. A missing
 * second parent is a placeholder card.
 */
let syntheticId = 0;
const nextId = () => -(++syntheticId);

/** The families of one person in drawing order (for the panel): [{ partner, kids }]. */
export function familiesOf(persons, parents, unions, personId) {
  const expanded = expandFamilies(persons, parents, unions);
  return expanded.groupsOf.get(personId) || [];
}

export function expandFamilies(persons, parents, unions) {
  const real = buildFamilies(persons, parents, unions);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const yearOf = (v) => (v ? Number(String(v).slice(0, 4)) : null);
  const birth = (id) => yearOf(byId.get(id)?.birthDate) ?? 9999;
  const unionOf = new Map(unions.map((u) => [pairKey(u.partnerA, u.partnerB), u]));

  // Families of every parent: one per partner (shared children) and one for
  // children without a known second parent.
  const groupsOf = new Map();
  for (const person of persons) {
    const kids = real.childrenOf.get(person.id) || [];
    const groups = [];
    for (const partner of real.partnersOf.get(person.id) || []) {
      const shared = kids.filter((k) => (real.parentsOf.get(k) || []).includes(partner));
      const union = unionOf.get(pairKey(person.id, partner)) || null;
      groups.push({ partner, kids: shared, order: yearOf(union?.startDate) ?? (shared.length ? Math.min(...shared.map(birth)) : 9000 + birth(partner)) });
    }
    const alone = kids.filter((k) => (real.parentsOf.get(k) || []).length === 1);
    if (alone.length) groups.push({ partner: null, kids: alone, order: Math.min(...alone.map(birth)) });
    // A manual order (person.familyOrder: partner ids, 0 = unknown) wins;
    // families not listed follow in the automatic order.
    const manual = Array.isArray(person.familyOrder) ? person.familyOrder : [];
    const rank = (g) => {
      const i = manual.indexOf(g.partner ?? 0);
      return i < 0 ? Infinity : i;
    };
    groups.sort((a, b) => rank(a) - rank(b) || a.order - b.order);
    groupsOf.set(person.id, groups);
  }

  const realOf = new Map(persons.map((p) => [p.id, p.id]));
  const copies = new Map(persons.map((p) => [p.id, [p.id]]));
  const dPersons = [...persons];
  const placeholders = new Set();
  // The card of `person` used for the family with `partner` (null = unknown).
  const cardFor = new Map();
  const cardKey = (person, partner) => `${person}|${partner ?? '?'}`;
  // Which family keeps the real card: the first one for people with parents
  // in the tree (it hangs under them); for people who married in, the family
  // whose partner is rooted in the tree — their other families stand beside it.
  const rooted = (id) => real.parentsOf.has(id);
  const orderOf = new Map();
  const anchorOf = new Map();
  for (const person of persons) {
    const groups = groupsOf.get(person.id);
    let anchor = 0;
    if (!rooted(person.id)) {
      const i = groups.findIndex((g) => g.partner !== null && rooted(g.partner));
      if (i > 0) anchor = i;
    }
    anchorOf.set(person.id, anchor);
  }
  for (const person of persons) {
    const groups = groupsOf.get(person.id);
    const anchor = anchorOf.get(person.id);
    groups.forEach((g, index) => {
      let id = person.id;
      if (index !== anchor) {
        id = nextId();
        realOf.set(id, person.id);
        copies.get(person.id).push(id);
        dPersons.push({ ...person, id, _real: person.id, _copy: index + 1 });
      }
      orderOf.set(id, index);
      cardFor.set(cardKey(person.id, g.partner), id);
      if (g.partner === null) {
        const ph = nextId();
        placeholders.add(ph);
        realOf.set(ph, null);
        dPersons.push({
          id: ph,
          _placeholder: true,
          _of: person.id,
          gender: person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'unknown',
          firstName: '',
          lastName: '',
          isAlive: true,
        });
        g.placeholder = ph;
      }
    });
  }
  const card = (person, partner) => cardFor.get(cardKey(person, partner)) ?? person;

  const dParents = [];
  for (const [child, list] of real.parentsOf) {
    if (list.length === 2) {
      const [a, b] = list;
      dParents.push({ childId: child, parentId: card(a, b) }, { childId: child, parentId: card(b, a) });
    } else {
      const p = list[0];
      const g = groupsOf.get(p).find((x) => x.partner === null);
      dParents.push({ childId: child, parentId: card(p, null) });
      if (g?.placeholder) dParents.push({ childId: child, parentId: g.placeholder });
    }
  }
  const dUnions = unions
    .filter((u) => byId.has(u.partnerA) && byId.has(u.partnerB))
    .map((u) => ({ ...u, partnerA: card(u.partnerA, u.partnerB), partnerB: card(u.partnerB, u.partnerA) }));

  // People with parents in the tree: each next family one block lower, under
  // the same card (continuation). People who married in: their other
  // families stand right beside the anchored card, in the same row (side).
  const sameAs = new Map();
  const continuation = new Map();
  const side = new Map();
  for (const [personId, list] of copies) {
    if (list.length < 2) continue;
    for (const id of list) sameAs.set(id, list.filter((x) => x !== id));
    const ordered = [...list].sort((a, b) => orderOf.get(a) - orderOf.get(b));
    if (rooted(personId)) {
      for (let i = 1; i < ordered.length; i += 1) continuation.set(ordered[i - 1], ordered[i]);
    } else {
      // A chain from the anchored card outwards: anchor — next — next…
      const anchor = personId;
      const rest = ordered.filter((id) => id !== anchor);
      let prev = anchor;
      for (const id of rest) {
        side.set(prev, [...(side.get(prev) || []), id]);
        side.set(id, [...(side.get(id) || []), prev]);
        prev = id;
      }
    }
  }
  return { persons: dPersons, parents: dParents, unions: dUnions, realOf, copies, sameAs, continuation, side, orderOf, placeholders, real, groupsOf };
}

/** Per-row extents of a subtree: gen → [left, right]. */
function mergeContour(into, from, shift = 0) {
  for (const [g, [l, r]] of from) {
    const cur = into.get(g);
    if (!cur) into.set(g, [l + shift, r + shift]);
    else into.set(g, [Math.min(cur[0], l + shift), Math.max(cur[1], r + shift)]);
  }
}

/** How far `next` must move right to clear `placed` on every shared row. */
function clearance(placed, next, gap) {
  let shift = -Infinity;
  for (const [g, [l]] of next) {
    const cur = placed.get(g);
    if (cur) shift = Math.max(shift, cur[1] + gap - l);
  }
  return shift === -Infinity ? null : shift;
}

/** The full layout: nodes, couple lines, family connectors and bounds. */
export function layoutTree(realPersons, realParents, realUnions) {
  const expanded = expandFamilies(realPersons, realParents, realUnions);
  const { persons, parents, unions } = expanded;
  const byId = new Map(persons.map((p) => [p.id, p]));
  const realById = new Map(realPersons.map((p) => [p.id, p]));
  const graph = buildFamilies(persons, parents, unions);
  graph.sameAs = expanded.sameAs;
  graph.side = expanded.side;
  graph.rowmates = new Map(graph.partnersOf);
  for (const [id, list] of expanded.side) graph.rowmates.set(id, [...(graph.rowmates.get(id) || []), ...list]);
  // For rows only, a continued card counts as a child of the previous one.
  graph.genParentsOf = new Map(graph.parentsOf);
  graph.genChildrenOf = new Map(graph.childrenOf);
  const continuedFrom = new Map();
  const continuedFromIds = new Set(expanded.continuation.values());
  graph.continuation = expanded.continuation;
  for (const [from, to] of expanded.continuation) {
    continuedFrom.set(to, from);
    graph.genParentsOf.set(to, [...(graph.genParentsOf.get(to) || []), from]);
    graph.genChildrenOf.set(from, [...(graph.genChildrenOf.get(from) || []), to]);
  }
  const realId = (id) => expanded.realOf.get(id) ?? null;
  const gen = assignGenerations(persons, graph);
  const { units, unitOf } = buildUnits(persons, gen, graph, byId, (id) => graph.parentsOf.has(id) || continuedFromIds.has(id));
  const maxGen = Math.max(0, ...units.map((u) => u.gen));
  const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);

  // Children of a unit, grouped by family from left to right — children of
  // the left partner only, then shared ones, then the right partner's — so
  // their lines do not cross; by birth inside a group.
  // A person's next family (the continued card) stands beside the children,
  // on that person's side of the couple.
  const childUnitsOf = (unit) => {
    const kids = unit.members.flatMap((id) => graph.childrenOf.get(id) || []).filter((id, i, all) => all.indexOf(id) === i);
    const side = (kid) => {
      const mine = (graph.parentsOf.get(kid) || []).map((p) => unit.members.indexOf(p)).filter((i) => i >= 0);
      return mine.reduce((s, i) => s + i, 0) / mine.length;
    };
    kids.sort((x, y) => side(x) - side(y) || birthKey(byId.get(x)).localeCompare(birthKey(byId.get(y))) || x - y);
    const list = kids.map((id) => ({ id, unit: unitOf.get(id) }));
    unit.members.forEach((id, index) => {
      const next = expanded.continuation.get(id);
      if (next === undefined) return;
      const entry = { id: next, unit: unitOf.get(next), continued: true };
      if (index === 0 && unit.members.length > 1) list.unshift(entry);
      else list.push(entry);
    });
    return list;
  };
  const descendants = (unit, seen = new Set()) => {
    if (seen.has(unit.id)) return 0;
    seen.add(unit.id);
    return 1 + childUnitsOf(unit).reduce((n, kid) => n + descendants(kid.unit, seen), 0);
  };

  // Every unit hangs under exactly one parent unit (the first that reaches it);
  // its other parents (in-laws) connect with a longer line. The biggest
  // families are walked first, so they keep their children close.
  const roots = units
    .filter((unit) => !unit.members.some((id) => graph.parentsOf.has(id) || continuedFrom.has(id)))
    .map((unit) => ({ unit, size: descendants(unit) }))
    .sort((a, b) => b.size - a.size || a.unit.gen - b.unit.gen)
    .map((entry) => entry.unit);
  const owner = new Map();
  const primaryKids = new Map(units.map((u) => [u.id, []]));
  const claim = (unit) => {
    for (const kid of childUnitsOf(unit)) {
      if (owner.has(kid.unit.id) || kid.unit === unit) continue;
      owner.set(kid.unit.id, unit.id);
      primaryKids.get(unit.id).push(kid);
    }
    for (const kid of primaryKids.get(unit.id)) claim(kid.unit);
  };
  for (const root of roots) {
    owner.set(root.id, null);
    claim(root);
  }
  // Units only reachable through a cycle of couples: treat as roots.
  for (const unit of units) {
    if (!owner.has(unit.id)) {
      owner.set(unit.id, null);
      roots.push(unit);
      claim(unit);
    }
  }

  const memberCenter = (unit, id) => unit.offsets[unit.members.indexOf(id)] + CARD_W / 2;
  // Where the unit's children hang from, relative to the unit's left edge.
  const anchorOf = (unit) => (unit.members.length === 2 ? CARD_W + PARTNER_GAP / 2 : unit.width / 2);

  // Tidy layout of one subtree; returns relative x of its units and its contour.
  // The couple sits centred over its own children; a remarried person's next
  // family (continuation) stands exactly under the card, joined by a straight
  // «same person» line — the children step aside to keep that column free.
  const LANE = 18;
  const layoutSubtree = (unit) => {
    const all = primaryKids.get(unit.id);
    const kids = all.filter((kid) => !kid.continued);
    const nexts = all.filter((kid) => kid.continued);
    const own = new Map([[unit.gen, [0, unit.width]]]);
    if (!kids.length && !nexts.length) return { xs: new Map([[unit, 0]]), contour: own };

    // Children, packed among themselves.
    const kidXs = new Map();
    const kidContour = new Map();
    const centers = [];
    let previousFamily = null;
    kids.forEach((kid, index) => {
      const sub = layoutSubtree(kid.unit);
      const family = (graph.parentsOf.get(kid.id) || []).join(',');
      const gap = index && family === previousFamily ? SIBLING_GAP : FAMILY_GAP;
      previousFamily = family;
      const shift = index ? clearance(kidContour, sub.contour, gap) ?? 0 : 0;
      for (const [u, ux] of sub.xs) kidXs.set(u, ux + shift);
      mergeContour(kidContour, sub.contour, shift);
      centers.push(kidXs.get(kid.unit) + memberCenter(kid.unit, kid.id));
    });

    let x = 0;
    if (kids.length) {
      let target = (Math.min(...centers) + Math.max(...centers)) / 2;
      // A child almost under the middle: put the couple exactly over them.
      // (Only a real middle child: with an even number the couple stays centred.)
      const nearest = centers.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), centers[0]);
      if (Math.abs(nearest - target) < CARD_W * 0.35) target = nearest;
      x = target - anchorOf(unit);
    }

    // Keep the column under the first continued card free of children.
    let kidShift = 0;
    const first = nexts[0];
    if (first && kids.length) {
      const from = continuedFrom.get(first.id);
      const index = unit.members.indexOf(from);
      const lineX = x + unit.offsets[index] + CARD_W / 2;
      const towardsRight = index < unit.members.length - 1 || unit.members.length === 1;
      for (const [, [l, r]] of kidContour) {
        if (towardsRight) kidShift = Math.max(kidShift, lineX + LANE - l);
        else kidShift = Math.min(kidShift, lineX - LANE - r);
      }
      if (towardsRight ? kidShift < 0 : kidShift > 0) kidShift = 0;
    }

    const xs = new Map();
    const contour = new Map();
    for (const [u, ux] of kidXs) xs.set(u, ux + kidShift);
    mergeContour(contour, kidContour, kidShift);
    xs.set(unit, x);
    mergeContour(contour, own, x);
    nexts.forEach((next, n) => {
      const sub = layoutSubtree(next.unit);
      const from = continuedFrom.get(next.id);
      let shift = x + memberCenter(unit, from) - (sub.xs.get(next.unit) + memberCenter(next.unit, next.id));
      const clear = clearance(contour, sub.contour, FAMILY_GAP);
      if (n > 0 && clear !== null && clear > shift) shift = clear;
      for (const [u, ux] of sub.xs) xs.set(u, ux + shift);
      mergeContour(contour, sub.contour, shift);
      // The column between the two cards is taken: neighbours keep away.
      const lineX = x + memberCenter(unit, from);
      for (let g = unit.gen + 1; g < next.unit.gen; g += 1) mergeContour(contour, new Map([[g, [lineX - LANE, lineX + LANE]]]));
    });
    return { xs, contour };
  };

  // Lay out the root trees side by side; roots whose children all belong to
  // other trees (parents of someone who married in) are placed afterwards.
  const pending = [];
  const world = new Map();
  let first = true;
  for (const root of roots) {
    const hasOwnKids = primaryKids.get(root.id).length > 0;
    const claimedKids = childUnitsOf(root).length > 0;
    if (!hasOwnKids && claimedKids) {
      pending.push(root);
      continue;
    }
    const sub = layoutSubtree(root);
    const shift = first ? 0 : clearance(world, sub.contour, FAMILY_GAP * 1.5) ?? Math.max(...[...world.values()].map(([, r]) => r)) + FAMILY_GAP * 1.5;
    first = false;
    for (const [u, x] of sub.xs) u.x = x + shift;
    mergeContour(world, sub.contour, shift);
  }

  // Occupied intervals per row for placing the pending units.
  const occupied = new Map();
  const occupy = (unit) => {
    if (!occupied.has(unit.gen)) occupied.set(unit.gen, []);
    occupied.get(unit.gen).push([unit.x, unit.x + unit.width]);
  };
  for (const unit of units) if (!pending.includes(unit)) occupy(unit);
  const xOfPerson = (id) => {
    const unit = unitOf.get(id);
    return unit.x + memberCenter(unit, id);
  };
  for (const unit of pending) {
    const kids = childUnitsOf(unit).map((kid) => xOfPerson(kid.id));
    const desired = (Math.min(...kids) + Math.max(...kids)) / 2 - anchorOf(unit);
    const taken = (occupied.get(unit.gen) || []).slice().sort((a, b) => a[0] - b[0]);
    const gap = FAMILY_GAP;
    // Candidate spots: the desired one and every edge next to a taken interval.
    const candidates = [desired];
    for (const [l, r] of taken) candidates.push(l - gap - unit.width, r + gap);
    const fits = (x) => taken.every(([l, r]) => x + unit.width + gap <= l || x >= r + gap);
    let best = null;
    for (const x of candidates) if (fits(x) && (best === null || Math.abs(x - desired) < Math.abs(best - desired))) best = x;
    unit.x = best ?? desired;
    occupy(unit);
  }

  // Normalise to start at 0.
  const minX = Math.min(...units.map((u) => u.x));
  for (const unit of units) unit.x -= minX;

  const nodes = [];
  for (const unit of units) {
    unit.members.forEach((id, index) => {
      const shown = byId.get(id);
      nodes.push({
        id,
        x: unit.x + unit.offsets[index],
        y: unit.gen * ROW_H,
        gen: unit.gen,
        person: shown._placeholder ? shown : realById.get(realId(id)),
        personId: realId(id),
        copy: expanded.orderOf.get(id) ?? 0,
        familyState: (() => {
          const mate = (graph.partnersOf.get(id) || [])[0];
          if (mate === undefined) return null;
          const u = unions.find((x) => (x.partnerA === id && x.partnerB === mate) || (x.partnerB === id && x.partnerA === mate));
          return unionState(u || null, realById.get(realId(id)), realById.get(realId(mate)));
        })(),
        copies: (expanded.copies.get(realId(id)) || []).length,
        placeholder: Boolean(shown._placeholder),
        of: shown._of || null,
      });
    });
  }
  const nodeOf = new Map(nodes.map((n) => [n.id, n]));

  const coupleLines = [];
  for (const couple of graph.couples.values()) {
    const a = nodeOf.get(couple.a);
    const b = nodeOf.get(couple.b);
    if (!a || !b) continue;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const adjacent = a.gen === b.gen && unitOf.get(a.id) === unitOf.get(b.id);
    coupleLines.push({
      key: pairKey(couple.a, couple.b),
      a: couple.a,
      b: couple.b,
      realA: realId(couple.a),
      realB: realId(couple.b),
      placeholder: expanded.placeholders.has(couple.a) || expanded.placeholders.has(couple.b),
      unionId: couple.union?.id || null,
      union: couple.union || null,
      status: couple.union?.status || null,
      state: unionState(couple.union, realById.get(realId(couple.a)), realById.get(realId(couple.b))),
      implied: couple.implied,
      adjacent,
      x1: left.x + CARD_W,
      x2: right.x,
      y: left.y + CARD_H / 2,
      y2: right.y + CARD_H / 2,
    });
  }

  // Family connectors with lanes, so neighbouring buses do not overlap.
  const connectors = [];
  const byRow = new Map();
  for (const family of graph.families.values()) {
    const parentNodes = family.parents.map((id) => nodeOf.get(id)).filter(Boolean);
    const kids = family.children.map((id) => nodeOf.get(id)).filter(Boolean);
    if (!parentNodes.length || !kids.length) continue;
    const couple = parentNodes.length === 2 ? coupleLines.find((c) => c.key === family.key) : null;
    let fromX;
    let fromY;
    if (couple && couple.adjacent) {
      fromX = (couple.x1 + couple.x2) / 2;
      fromY = couple.y;
    } else {
      fromX = avg(parentNodes.map((n) => n.x + CARD_W / 2));
      fromY = Math.max(...parentNodes.map((n) => n.y)) + CARD_H;
    }
    const childTop = Math.min(...kids.map((n) => n.y));
    const xs = kids.map((n) => n.x + CARD_W / 2);
    // A child drawn in another branch (they hang under their partner's
    // family) gets its own light curve instead of stretching the bus.
    const parentUnits = new Set(family.parents.map((id) => unitOf.get(id)?.id));
    const drops = kids.map((n) => ({ id: n.id, realId: n.personId, x: n.x + CARD_W / 2, y: n.y, secondary: !parentUnits.has(owner.get(unitOf.get(n.id).id)) }));
    const main = drops.filter((d) => !d.secondary).map((d) => d.x);
    const connector = {
      key: family.key,
      secondary: !main.length,
      parents: family.parents,
      realParents: family.parents.map(realId).filter((id) => id !== null),
      children: family.children,
      fromX,
      fromY,
      busY: childTop - ROW_GAP / 2,
      minX: Math.min(fromX, ...(main.length ? main : [fromX])),
      maxX: Math.max(fromX, ...(main.length ? main : [fromX])),
      drops,
      lane: 0,
    };
    connectors.push(connector);
    if (!byRow.has(childTop)) byRow.set(childTop, []);
    byRow.get(childTop).push(connector);
  }
  for (const list of byRow.values()) {
    list.sort((a, b) => a.minX - b.minX);
    const lanes = [];
    for (const c of list) {
      let lane = 0;
      while (lanes[lane] !== undefined && lanes[lane] > c.minX - 12) lane += 1;
      lanes[lane] = c.maxX;
      c.lane = lane;
    }
    const used = Math.max(0, ...list.map((c) => c.lane));
    for (const c of list) c.busY += (c.lane - used / 2) * 12;
  }

  const width = Math.max(CARD_W, ...nodes.map((n) => n.x + CARD_W));
  const height = (maxGen + 1) * ROW_H - ROW_GAP;
  // «Same person» lines: from a card down to its next family.
  const sameLines = [];
  for (const [from, to] of expanded.continuation) {
    const a = nodeOf.get(from);
    const b = nodeOf.get(to);
    if (!a || !b) continue;
    // Along the outer side of the column, so it never crosses the children
    // standing between the two cards.
    const cx = a.x + CARD_W / 2;
    // Exactly under: one straight line from card to card.
    if (Math.abs(b.x - a.x) < 2) {
      sameLines.push({ key: `${from}>${to}`, realId: realId(from), points: [[cx, a.y + CARD_H], [cx, b.y]] });
      continue;
    }
    // Elsewhere (the second remarried partner): down, across above the row, into the top.
    const start = [[cx, a.y + CARD_H], [cx, a.y + CARD_H + 14]];
    const end = [[b.x + CARD_W / 2, a.y + CARD_H + 14], [b.x + CARD_W / 2, b.y]];
    sameLines.push({ key: `${from}>${to}`, realId: realId(from), points: [...start, ...end] });
  }

  for (const [from, list] of expanded.side) {
    for (const to of list) {
      if (from > to) continue; // each pair once
      const a = nodeOf.get(from);
      const b = nodeOf.get(to);
      if (!a || !b) continue;
      const [l, r] = a.x <= b.x ? [a, b] : [b, a];
      const y = l.y + 10;
      sameLines.push({ key: `${from}~${to}`, realId: realId(from), side: true, points: [[l.x + CARD_W - 18, l.y], [l.x + CARD_W - 18, y - 22], [r.x + 18, y - 22], [r.x + 18, r.y]] });
    }
  }

  // Kinship, highlighting and quick-add work on the real people.
  return { nodes, coupleLines, connectors, sameLines, width, height, generations: maxGen + 1, graph: expanded.real, display: graph };
}

/** Rounded orthogonal path through points (x, y). */
export function roundedPath(points, radius = 12) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (!r) {
      d += ` L ${x} ${y}`;
      continue;
    }
    const ix = x - ((x - px) / inLen) * r;
    const iy = y - ((y - py) / inLen) * r;
    const ox = x + ((nx - x) / outLen) * r;
    const oy = y + ((ny - y) / outLen) * r;
    d += ` L ${ix} ${iy} Q ${x} ${y} ${ox} ${oy}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

/** SVG paths of one family connector: trunk and one drop per child. */
/**
 * State of a couple for drawing: 'active', 'ended' (divorced / separated) or
 * 'widowed' (marked so, or one of the partners has died).
 */
export function unionState(union, a, b) {
  if (union && ['divorced', 'separated'].includes(union.status)) return 'ended';
  if ((union && union.status === 'widowed') || (a && a.isAlive === false) || (b && b.isAlive === false)) return 'widowed';
  return 'active';
}

export function connectorPaths(c) {
  const paths = [];
  for (const drop of c.drops) {
    if (drop.secondary) {
      const dy = drop.y - c.fromY;
      paths.push({ id: drop.id, secondary: true, d: `M ${c.fromX} ${c.fromY} C ${c.fromX} ${c.fromY + dy * 0.75}, ${drop.x} ${drop.y - dy * 0.75}, ${drop.x} ${drop.y}` });
      continue;
    }
    if (Math.abs(drop.x - c.fromX) < 1) {
      paths.push({ id: drop.id, d: `M ${c.fromX} ${c.fromY} L ${drop.x} ${drop.y}` });
    } else {
      paths.push({
        id: drop.id,
        d: roundedPath([
          [c.fromX, c.fromY],
          [c.fromX, c.busY],
          [drop.x, c.busY],
          [drop.x, drop.y],
        ]),
      });
    }
  }
  return paths;
}

/** Ancestors and descendants of a person (for highlighting a line of descent). */
export function lineage(graph, personId) {
  const up = new Set();
  const down = new Set();
  const climb = (id) => {
    for (const parent of graph.parentsOf.get(id) || []) if (!up.has(parent)) (up.add(parent), climb(parent));
  };
  const descend = (id) => {
    for (const child of graph.childrenOf.get(id) || []) if (!down.has(child)) (down.add(child), descend(child));
  };
  climb(personId);
  descend(personId);
  return { up, down };
}
