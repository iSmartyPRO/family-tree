/*
 * Relatives of one person, from the raw tree data (persons, parents, unions).
 */

export function indexTree(data) {
  const persons = new Map((data?.persons || []).map((p) => [p.id, p]));
  const parentLinks = data?.parents || [];
  const unions = data?.unions || [];
  return { persons, parentLinks, unions };
}

export function kinOf(index, personId) {
  const { persons, parentLinks, unions } = index;
  const parents = parentLinks.filter((l) => l.childId === personId).map((l) => ({ link: l, person: persons.get(l.parentId) }));
  const children = parentLinks.filter((l) => l.parentId === personId).map((l) => ({ link: l, person: persons.get(l.childId) }));
  const partners = unions
    .filter((u) => u.partnerA === personId || u.partnerB === personId)
    .map((u) => ({ union: u, person: persons.get(u.partnerA === personId ? u.partnerB : u.partnerA) }));
  const parentIds = new Set(parents.map((p) => p.person?.id));
  const siblings = new Map();
  if (parentIds.size) {
    for (const link of parentLinks) {
      if (!parentIds.has(link.parentId) || link.childId === personId) continue;
      const theirs = new Set(parentLinks.filter((l) => l.childId === link.childId).map((l) => l.parentId));
      const shared = [...parentIds].filter((id) => theirs.has(id)).length;
      const full = shared === parentIds.size && shared === theirs.size;
      siblings.set(link.childId, { person: persons.get(link.childId), half: !full });
    }
  }
  const byBirth = (a, b) => String(a.person?.birthDate || '9999').localeCompare(String(b.person?.birthDate || '9999'));
  return {
    parents: parents.filter((p) => p.person),
    partners: partners.filter((p) => p.person),
    children: children.filter((c) => c.person).sort(byBirth),
    siblings: [...siblings.values()].filter((s) => s.person).sort(byBirth),
  };
}

/**
 * One-click fixes: a child linked to only one parent, when that parent has
 * exactly one partner → offer the partner as the second parent.
 */
export function missingParentSuggestion(index, personId) {
  const kin = kinOf(index, personId);
  if (kin.parents.length !== 1) return null;
  const parent = kin.parents[0].person;
  const partnerKin = kinOf(index, parent.id).partners;
  if (partnerKin.length !== 1) return null;
  return { parent, partner: partnerKin[0].person };
}

/** People who can still be linked as a parent of `personId` (not descendants, not linked). */
export function candidates(index, personId, kind) {
  const { persons, parentLinks, unions } = index;
  const descendants = new Set();
  const stack = [personId];
  while (stack.length) {
    const id = stack.pop();
    for (const l of parentLinks) if (l.parentId === id && !descendants.has(l.childId)) (descendants.add(l.childId), stack.push(l.childId));
  }
  const ancestors = new Set();
  const up = [personId];
  while (up.length) {
    const id = up.pop();
    for (const l of parentLinks) if (l.childId === id && !ancestors.has(l.parentId)) (ancestors.add(l.parentId), up.push(l.parentId));
  }
  const linked = new Set();
  if (kind === 'parent') parentLinks.filter((l) => l.childId === personId).forEach((l) => linked.add(l.parentId));
  if (kind === 'child') parentLinks.filter((l) => l.parentId === personId).forEach((l) => linked.add(l.childId));
  if (kind === 'partner') unions.filter((u) => u.partnerA === personId || u.partnerB === personId).forEach((u) => linked.add(u.partnerA === personId ? u.partnerB : u.partnerA));
  return [...persons.values()].filter((p) => {
    if (p.id === personId || linked.has(p.id)) return false;
    if (kind === 'parent') return !descendants.has(p.id);
    if (kind === 'child') return !ancestors.has(p.id) && parentLinks.filter((l) => l.childId === p.id).length < 2;
    if (kind === 'partner') return !descendants.has(p.id) && !ancestors.has(p.id);
    return true;
  });
}
