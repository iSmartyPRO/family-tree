/*
 * Family calendar: birthdays and memorial days, every year again. Only full
 * dates (YYYY-MM-DD) have a day in the calendar; people born on 29 February
 * are remembered on the 28th in other years.
 */

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Day of the month a date falls on in `year` (29 Feb → 28 Feb). */
function dayIn(year, month, day) {
  return month === 2 && day === 29 && !isLeap(year) ? 28 : day;
}

/** Yearly dates of everyone: [{ key, type: 'birth' | 'death', person, year, month, day }]. */
export function annualDates(persons) {
  const list = [];
  let undated = 0;
  for (const person of persons) {
    const born = String(person.birthDate || '').match(FULL);
    const died = !person.isAlive && String(person.deathDate || '').match(FULL);
    if (born) list.push({ key: `b${person.id}`, type: 'birth', person, year: +born[1], month: +born[2], day: +born[3] });
    if (died) list.push({ key: `d${person.id}`, type: 'death', person, year: +died[1], month: +died[2], day: +died[3] });
    if (!born && (person.isAlive || !died)) undated += 1;
  }
  return { list, undated };
}

/**
 * The dates as they fall in `year`: each with its day and how many years it
 * marks (`years`: the age turned, or years since). A memorial day starts the
 * year after the death; a birthday from the year of birth.
 */
export function occurrencesIn(dates, year) {
  const out = [];
  for (const d of dates) {
    const years = year - d.year;
    if (years < 0 || (d.type === 'death' && years < 1)) continue;
    const day = dayIn(year, d.month, d.day);
    out.push({ ...d, date: new Date(year, d.month - 1, day), years, alive: d.person.isAlive !== false });
  }
  return out.sort(byDate);
}

/** Birthdays first within a day, then by name. */
function byDate(a, b) {
  return a.date - b.date || (a.type === b.type ? 0 : a.type === 'birth' ? -1 : 1) || String(a.person.firstName || '').localeCompare(String(b.person.firstName || ''));
}

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
export const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / 86400000);

/** The next dates from today on: within `days`, at least `min` of them. */
export function upcoming(dates, today = new Date(), { days = 45, min = 6, max = 14 } = {}) {
  const from = startOfDay(today);
  const seen = new Set();
  const all = [...occurrencesIn(dates, from.getFullYear()), ...occurrencesIn(dates, from.getFullYear() + 1)]
    .filter((o) => o.date >= from && !seen.has(o.key) && seen.add(o.key))
    .map((o) => ({ ...o, inDays: daysBetween(from, o.date) }));
  const near = all.filter((o) => o.inDays <= days);
  return (near.length >= min ? near : all.slice(0, min)).slice(0, max);
}

/** Weeks of a month for a grid: arrays of 7 Dates (null outside the month). */
export function monthWeeks(year, month, weekStart = 1) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const pad = (n) => String(n).padStart(2, '0');
const icsText = (value) => String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Folds lines longer than 75 octets, as RFC 5545 asks. */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * An iCalendar file with every date as a yearly all-day event and a reminder
 * the evening before; it starts this year, so calendars do not fill the past.
 * `label(date)` → { summary, description }.
 */
export function toIcs(dates, { name, label, uidPrefix, year = new Date().getFullYear(), reminder = true }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iSmarty//Family tree//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(name)}`];
  for (const d of dates) {
    const first = d.type === 'death' ? Math.max(year, d.year + 1) : Math.max(year, d.year);
    const leapDay = d.month === 2 && d.day === 29;
    const day = dayIn(first, d.month, d.day);
    const start = `${first}${pad(d.month)}${pad(day)}`;
    const next = new Date(first, d.month - 1, day + 1);
    const end = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    const { summary, description } = label(d);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidPrefix}-${d.key}@family`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      leapDay ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY',
      `SUMMARY:${icsText(summary)}`,
      ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
      'TRANSP:TRANSPARENT'
    );
    if (reminder) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(summary)}`, 'TRIGGER:-PT6H', 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
