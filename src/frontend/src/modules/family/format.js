/*
 * Names, dates and ages of people in a tree. Dates are partial strings:
 * "1950", "1950-03" or "1950-03-08" — shown as precisely as they are known.
 */

const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export function displayName(person, { withPatronymic = false } = {}) {
  if (!person) return '';
  const parts = [person.lastName, person.firstName];
  if (withPatronymic) parts.push(person.patronymic);
  return parts.filter(Boolean).join(' ') || '—';
}

export function shortName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';
}

export function initials(person) {
  const letters = [person?.firstName, person?.lastName].filter(Boolean).map((part) => part.trim()[0]);
  return (letters.join('') || '?').toUpperCase().slice(0, 2);
}

export const yearOf = (value) => (value ? Number(String(value).slice(0, 4)) : null);

/** "1950 – 2011", "1950", "? – 2011" or "" for the card (no religious signs). */
export function lifeYears(person) {
  const born = yearOf(person.birthDate);
  const died = person.isAlive ? null : yearOf(person.deathDate);
  if (born && died) return `${born} – ${died}`;
  if (born) return person.isAlive ? `${born}` : `${born} – ?`;
  if (died) return `? – ${died}`;
  return '';
}

/** Full years between two partial dates; null when unknown. */
export function ageBetween(from, to) {
  const a = String(from || '').match(DATE);
  const b = String(to || '').match(DATE);
  if (!a || !b) return null;
  let age = Number(b[1]) - Number(a[1]);
  if (a[2] && b[2]) {
    const before = Number(b[2]) < Number(a[2]) || (b[2] === a[2] && a[3] && b[3] && Number(b[3]) < Number(a[3]));
    if (before) age -= 1;
  }
  return age >= 0 && age < 150 ? age : null;
}

export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** How old someone who died would be today — only while that is plausible (≤ 110). */
export function wouldBeNow(person) {
  if (!person?.birthDate || person.isAlive) return null;
  const age = ageBetween(person.birthDate, todayIso());
  return age !== null && age <= 110 ? age : null;
}

/** Listed as living but older than anyone plausibly is: probably has died. */
export const IMPLAUSIBLE_AGE = 105;
export function maybeDeceased(person) {
  if (!person?.isAlive || !person.birthDate) return false;
  const age = ageBetween(person.birthDate, todayIso());
  return age !== null && age > IMPLAUSIBLE_AGE;
}

/** Current age of the living, age at death of the dead. */
export function ageOf(person) {
  if (!person?.birthDate) return null;
  if (person.isAlive) return ageBetween(person.birthDate, todayIso());
  return person.deathDate ? ageBetween(person.birthDate, person.deathDate) : null;
}

/** A partial date in the reader's order: 08.03.1950, 03.1950, 1950. */
export function formatPartial(value, dateFormat = 'DD.MM.YYYY') {
  const m = String(value || '').match(DATE);
  if (!m) return '';
  const [, y, mo, d] = m;
  if (!mo) return y;
  const usFirst = dateFormat.startsWith('MM');
  const sep = dateFormat.includes('/') ? '/' : dateFormat.includes('-') ? '-' : '.';
  if (dateFormat === 'YYYY-MM-DD') return d ? `${y}-${mo}-${d}` : `${y}-${mo}`;
  if (!d) return `${mo}${sep}${y}`;
  return usFirst ? `${mo}${sep}${d}${sep}${y}` : `${d}${sep}${mo}${sep}${y}`;
}

/**
 * What a person typed → stored partial date. Accepts 1950, 03.1950,
 * 8.3.1950, 1950-03-08, 08/03/1950 (day first unless `monthFirst`).
 * Returns '' for empty, null for something that is not a date.
 */
export function parsePartial(text, { monthFirst = false } = {}) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (DATE.test(raw)) return validIso(raw) ? raw : null;
  // Digits only (phone keypads): DDMMYYYY or MMYYYY.
  if (/^\d{8}$/.test(raw)) return parsePartial(`${raw.slice(0, 2)}.${raw.slice(2, 4)}.${raw.slice(4)}`, { monthFirst });
  if (/^\d{6}$/.test(raw)) return parsePartial(`${raw.slice(0, 2)}.${raw.slice(2)}`, { monthFirst });
  const parts = raw.split(/[.,\-/\s]+/).filter(Boolean);
  if (parts.length === 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{4}$/.test(parts[1])) {
    return validIso(`${parts[1]}-${parts[0].padStart(2, '0')}`);
  }
  if (parts.length === 3 && /^\d{4}$/.test(parts[2])) {
    const [p, q, year] = parts;
    const [day, month] = monthFirst ? [q, p] : [p, q];
    return validIso(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  return null;
}

function validIso(value) {
  const m = value.match(DATE);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (mo && (Number(mo) < 1 || Number(mo) > 12)) return null;
  if (d) {
    const last = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
    if (Number(d) < 1 || Number(d) > last) return null;
  }
  return value;
}

/** Search haystack of a person. */
export function searchText(person) {
  return [person.lastName, person.firstName, person.patronymic, person.maidenName, person.birthPlace, yearOf(person.birthDate)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
