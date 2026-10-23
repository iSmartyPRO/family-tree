/*
 * How a person is related to «me»: the key of a kinship term, the gender of
 * the person, and the side (father's / mother's) for relatives above me.
 * Found through the closest common ancestor (a steps up from me, b steps down
 * to them); partners and in-laws are checked first.
 */

function ancestorsWithDistance(parentsOf, start) {
  const dist = new Map([[start, { d: 0, via: null }]]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    const { d, via } = dist.get(id);
    for (const p of parentsOf.get(id) || []) {
      if (dist.has(p)) continue;
      dist.set(p, { d: d + 1, via: d === 0 ? p : via });
      queue.push(p);
    }
  }
  return dist;
}

/** Blood relation: { a, b, sideVia } or null. */
function blood(graph, me, other) {
  const mine = ancestorsWithDistance(graph.parentsOf, me);
  const theirs = ancestorsWithDistance(graph.parentsOf, other);
  let best = null;
  for (const [id, t] of theirs) {
    const m = mine.get(id);
    if (!m) continue;
    if (!best || m.d + t.d < best.a + best.b) best = { a: m.d, b: t.d, via: m.via, lca: id };
  }
  return best;
}

function bloodKey(a, b) {
  if (a === 0 && b === 0) return 'self';
  if (b === 0) return a === 1 ? 'parent' : a === 2 ? 'grandparent' : a === 3 ? 'greatGrandparent' : 'ancestor';
  if (a === 0) return b === 1 ? 'child' : b === 2 ? 'grandchild' : b === 3 ? 'greatGrandchild' : 'descendant';
  if (a === 1 && b === 1) return 'sibling';
  if (a === 2 && b === 1) return 'uncleAunt';
  if (a >= 3 && b === 1) return 'greatUncleAunt';
  if (a === 1 && b === 2) return 'nephewNiece';
  if (a === 1 && b >= 3) return 'grandNephewNiece';
  if (a === 2 && b === 2) return 'cousin';
  if (a === 2 && b === 3) return 'cousinChild';
  if (a === 3 && b === 2) return 'parentCousin';
  if (a === 3 && b === 3) return 'secondCousin';
  return 'relative';
}

/**
 * `graph` = { parentsOf, partnersOf, byId } (layout's buildFamilies + a byId).
 * Returns { key, gender, side } or null when not related through the tree.
 */
export function kinship(graph, byId, meId, otherId) {
  if (!meId || !otherId || !byId.has(meId) || !byId.has(otherId)) return null;
  const gender = byId.get(otherId)?.gender || 'unknown';
  const sideOf = (via) => {
    const g = byId.get(via)?.gender;
    return g === 'male' ? 'father' : g === 'female' ? 'mother' : null;
  };
  if (meId === otherId) return { key: 'self', gender };
  const partners = (id) => graph.partnersOf.get(id) || [];
  if (partners(meId).includes(otherId)) return { key: 'partner', gender };

  const direct = blood(graph, meId, otherId);
  if (direct) {
    const key = bloodKey(direct.a, direct.b);
    let half = false;
    if (key === 'sibling') {
      const mine = graph.parentsOf.get(meId) || [];
      const theirs = graph.parentsOf.get(otherId) || [];
      half = !(mine.length === theirs.length && mine.every((p) => theirs.includes(p)));
    }
    return { key: half ? 'halfSibling' : key, gender, side: direct.a >= 2 ? sideOf(direct.via) : null };
  }

  // Partner of a blood relative: son-/daughter-in-law, brother-in-law, step-parent…
  for (const partner of partners(otherId)) {
    const rel = blood(graph, meId, partner);
    if (!rel) continue;
    const key = bloodKey(rel.a, rel.b);
    const map = { child: 'childInLaw', sibling: 'siblingInLaw', parent: 'stepParent', grandchild: 'grandchildInLaw', uncleAunt: 'uncleAunt', nephewNiece: 'nephewNieceInLaw', cousin: 'cousinInLaw' };
    if (map[key]) return { key: map[key], gender, side: rel.a >= 2 ? sideOf(rel.via) : null };
  }
  // Blood relative of my partner: parents-, brothers-, children-in-law.
  for (const partner of partners(meId)) {
    const rel = blood(graph, partner, otherId);
    if (!rel) continue;
    const key = bloodKey(rel.a, rel.b);
    const map = { parent: 'parentInLaw', sibling: 'siblingInLaw', child: 'stepChild', grandparent: 'grandparentInLaw' };
    if (map[key]) return { key: map[key], gender };
    return { key: 'partnerRelative', gender };
  }
  return null;
}

/** Translated label: «grandfather (father's side)». */
export function kinLabel(t, rel) {
  if (!rel) return null;
  const g = rel.gender === 'male' ? 'male' : rel.gender === 'female' ? 'female' : 'unknown';
  const word = t(`family.kin.${rel.key}.${g}`);
  return rel.side ? t(`family.kin.side.${rel.side}`, { word }) : word;
}
