/*
 * Views of a tree: which people a filter shows. Pure functions over the links
 * (no database), shared by the private API, public links and cloning.
 *
 *   filter = {
 *     focus:       person id the view is built around (required here)
 *     side:        'both' | 'father' | 'mother' — which parent's line goes up
 *     ancestors:   generations up (0…MAX)
 *     descendants: generations down (0…MAX)
 *     collateral:  side branches from every ancestor (and the focus):
 *                  0 none · 1 brothers/sisters, aunts/uncles · 2 + their children
 *                  (cousins, nephews) · 3 + grandchildren
 *     partners:    show partners (and co-parents) of everyone shown
 *   }
 */

export const MAX_DEPTH = 12;
export const SIDES = ['both', 'father', 'mother'];

const int = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function cleanFilter(input = {}) {
  return {
    focus: Number(input.focus) || null,
    side: SIDES.includes(input.side) ? input.side : 'both',
    ancestors: int(input.ancestors, 0, MAX_DEPTH, MAX_DEPTH),
    descendants: int(input.descendants, 0, MAX_DEPTH, MAX_DEPTH),
    collateral: int(input.collateral, 0, 3, 1),
    partners: input.partners !== false,
  };
}

export function buildIndex(persons, parents, unions) {
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
  const add = (a, b) => {
    if (!partnersOf.has(a)) partnersOf.set(a, new Set());
    partnersOf.get(a).add(b);
  };
  for (const u of unions) {
    if (!byId.has(u.partnerA) || !byId.has(u.partnerB)) continue;
    add(u.partnerA, u.partnerB);
    add(u.partnerB, u.partnerA);
  }
  return { byId, parentsOf, childrenOf, partnersOf };
}

/** The parent on one side: the father (male) or the mother (female). */
export function parentOnSide(index, personId, side) {
  const list = index.parentsOf.get(personId) || [];
  if (side === 'both') return list;
  const want = side === 'father' ? 'male' : 'female';
  const match = list.filter((id) => index.byId.get(id)?.gender === want);
  if (match.length) return match;
  // Gender not recorded: with two parents, the other one is on the opposite side.
  const other = list.filter((id) => index.byId.get(id)?.gender === (want === 'male' ? 'female' : 'male'));
  return other.length ? list.filter((id) => !other.includes(id)) : [];
}

/** Ids of the people a filter shows (always includes the focus). */
export function selectPeople(index, rawFilter) {
  const filter = cleanFilter(rawFilter);
  const focus = filter.focus;
  if (!focus || !index.byId.has(focus)) return { ids: new Set(), filter };
  const ids = new Set([focus]);
  const line = new Map([[focus, 0]]); // direct ancestors → generation

  // Up: the chosen side first, then every line above it.
  let level = [focus];
  for (let depth = 1; depth <= filter.ancestors && level.length; depth += 1) {
    const next = [];
    for (const id of level) {
      const ups = depth === 1 ? parentOnSide(index, id, filter.side) : index.parentsOf.get(id) || [];
      for (const parent of ups) {
        if (line.has(parent)) continue;
        line.set(parent, depth);
        ids.add(parent);
        next.push(parent);
      }
    }
    level = next;
  }

  // Down from the focus.
  const down = (from, depth) => {
    let layer = [from];
    for (let d = 1; d <= depth && layer.length; d += 1) {
      const next = [];
      for (const id of layer) {
        for (const child of index.childrenOf.get(id) || []) {
          if (ids.has(child)) continue;
          ids.add(child);
          next.push(child);
        }
      }
      layer = next;
    }
  };
  down(focus, filter.descendants);

  // Side branches: from each ancestor down `collateral` generations; the
  // focus's own parents give brothers and sisters.
  if (filter.collateral > 0) {
    for (const [ancestor, generation] of line) {
      if (generation === 0) continue;
      down(ancestor, filter.collateral);
    }
  }

  // Partners of everyone shown, and the other parent of shown children.
  if (filter.partners) {
    for (const id of [...ids]) {
      for (const partner of index.partnersOf.get(id) || []) ids.add(partner);
      for (const child of index.childrenOf.get(id) || []) {
        if (!ids.has(child)) continue;
        for (const coParent of index.parentsOf.get(child) || []) ids.add(coParent);
      }
    }
  }
  return { ids, filter };
}

/** Keeps only the selected people and the links between them. */
export function subGraph(graph, ids) {
  return {
    persons: graph.persons.filter((p) => ids.has(p.id)),
    parents: graph.parents.filter((l) => ids.has(l.childId) && ids.has(l.parentId)),
    unions: graph.unions.filter((u) => ids.has(u.partnerA) && ids.has(u.partnerB)),
  };
}
