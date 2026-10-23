import { httpError } from '../shared/acl.js';

/*
 * Pure rules of the family tree: input cleaning and the checks that keep the
 * graph sane. No database here, so they are covered by test/family.test.js.
 */

export const GENDERS = ['male', 'female', 'unknown'];
export const PARENT_KINDS = ['birth', 'adoptive', 'step', 'foster'];
export const UNION_STATUSES = ['married', 'partners', 'engaged', 'divorced', 'separated', 'widowed'];
export const CONTACT_KEYS = ['phone', 'email', 'whatsapp', 'telegram', 'instagram', 'facebook', 'linkedin', 'vk', 'ok', 'website'];
export const MAX_PARENTS = 2;

const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * A date as precise as it is known: "1950", "1950-03" or "1950-03-08".
 * Empty → null. Anything else → 400.
 */
export function cleanDate(value, field = 'date') {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(DATE);
  const bad = () => httpError(400, `Invalid ${field}: use YYYY, YYYY-MM or YYYY-MM-DD`, 'INVALID_DATE');
  if (!match) throw bad();
  const [, y, m, d] = match;
  const year = Number(y);
  if (year < 1 || year > 2200) throw bad();
  if (m !== undefined) {
    const month = Number(m);
    if (month < 1 || month > 12) throw bad();
    if (d !== undefined) {
      const day = Number(d);
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (day < 1 || day > last) throw bad();
    }
  }
  return raw;
}

/** Compares two partial dates on the precision both have; null when unknown. */
export function compareDates(a, b) {
  if (!a || !b) return null;
  const len = Math.min(a.length, b.length);
  const x = a.slice(0, len);
  const y = b.slice(0, len);
  return x === y ? 0 : x < y ? -1 : 1;
}

function cleanContacts(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of CONTACT_KEYS) {
    const value = text(input[key], 200);
    if (value) out[key] = value;
  }
  return out;
}

/** Order of a person's families: partner ids (0 = unknown other parent), no repeats. */
export function cleanFamilyOrder(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value.slice(0, 30)) {
    const n = Number(item);
    if (Number.isInteger(n) && n >= 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Cleans a person from the API. `current` is the stored person when editing:
 * fields that are not sent keep their value.
 */
export function cleanPerson(input = {}, current = null) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const base = current || {};
  const person = {
    firstName: text(pick('firstName', base.firstName), 80),
    lastName: text(pick('lastName', base.lastName), 80),
    patronymic: text(pick('patronymic', base.patronymic), 80),
    maidenName: text(pick('maidenName', base.maidenName), 80),
    gender: GENDERS.includes(pick('gender', base.gender)) ? pick('gender', base.gender) : 'unknown',
    birthDate: cleanDate(pick('birthDate', base.birthDate), 'birth date'),
    birthPlace: text(pick('birthPlace', base.birthPlace), 160),
    isAlive: pick('isAlive', base.isAlive ?? true) !== false,
    deathDate: cleanDate(pick('deathDate', base.deathDate), 'death date'),
    deathPlace: text(pick('deathPlace', base.deathPlace), 160),
    occupation: text(pick('occupation', base.occupation), 160),
    bio: String(pick('bio', base.bio) ?? '').trim().slice(0, 20000),
    contacts: input.contacts === undefined ? cleanContacts(base.contacts) : cleanContacts(input.contacts),
    familyOrder: cleanFamilyOrder(input.familyOrder === undefined ? base.familyOrder : input.familyOrder),
  };
  if (!person.firstName && !person.lastName) throw httpError(400, 'Enter a first or last name', 'NAME_REQUIRED');
  if (person.isAlive) {
    person.deathDate = null;
    person.deathPlace = '';
  }
  if (compareDates(person.deathDate, person.birthDate) === -1) {
    throw httpError(400, 'Date of death is before date of birth', 'DEATH_BEFORE_BIRTH');
  }
  return person;
}

export function cleanUnion(input = {}, current = null) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const base = current || {};
  const status = pick('status', base.status || 'married');
  const union = {
    status: UNION_STATUSES.includes(status) ? status : 'married',
    startDate: cleanDate(pick('startDate', base.startDate), 'start date'),
    endDate: cleanDate(pick('endDate', base.endDate), 'end date'),
  };
  if (compareDates(union.endDate, union.startDate) === -1) throw httpError(400, 'The end is before the start', 'END_BEFORE_START');
  return union;
}

export function cleanTree(input = {}, current = null) {
  const name = text(input.name === undefined ? current?.name : input.name, 120);
  if (!name) throw httpError(400, 'Enter a name for the tree', 'NAME_REQUIRED');
  const description = String((input.description === undefined ? current?.description : input.description) ?? '').trim().slice(0, 2000);
  return { name, description };
}

/** child → [parents] map from rows of family_parents. */
export function parentsMap(links) {
  const map = new Map();
  for (const link of links) {
    const list = map.get(link.childId) || [];
    list.push(link.parentId);
    map.set(link.childId, list);
  }
  return map;
}

/** True when `ancestorId` is `personId` or one of their ancestors. */
export function isAncestor(parents, personId, ancestorId) {
  const seen = new Set();
  const stack = [personId];
  while (stack.length) {
    const id = stack.pop();
    if (id === ancestorId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const parent of parents.get(id) || []) stack.push(parent);
  }
  return false;
}

/**
 * Checks a new child → parent link against the existing ones: not oneself,
 * no duplicates, at most two parents, and no cycles (a parent cannot be the
 * child's own descendant).
 */
export function checkParentLink(links, childId, parentId) {
  if (childId === parentId) throw httpError(400, 'A person cannot be their own parent', 'SELF_LINK');
  const parents = parentsMap(links);
  const current = parents.get(childId) || [];
  if (current.includes(parentId)) throw httpError(409, 'This parent is already linked', 'DUPLICATE');
  if (current.length >= MAX_PARENTS) throw httpError(400, 'A person can have at most two parents', 'TOO_MANY_PARENTS');
  if (isAncestor(parents, parentId, childId)) {
    throw httpError(400, 'This link would make a person their own ancestor', 'CYCLE');
  }
}

/** Checks a new couple: two different people who are not parent and child. */
export function checkUnion(links, unions, a, b) {
  if (a === b) throw httpError(400, 'A person cannot be their own partner', 'SELF_LINK');
  const exists = unions.some((u) => (u.partnerA === a && u.partnerB === b) || (u.partnerA === b && u.partnerB === a));
  if (exists) throw httpError(409, 'These two are already a couple', 'DUPLICATE');
  const parents = parentsMap(links);
  if (isAncestor(parents, a, b) || isAncestor(parents, b, a)) {
    throw httpError(400, 'An ancestor and a descendant cannot be a couple', 'ANCESTOR_UNION');
  }
}

/** "Last First Patronymic" for exports and logs. */
export function fullName(person) {
  return [person.lastName, person.firstName, person.patronymic].filter(Boolean).join(' ');
}
