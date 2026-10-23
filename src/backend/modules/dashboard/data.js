import { query } from '../../config/database.js';
import { decide } from '../../api/scopes.js';
import { getSettingsView } from '../../services/settings.js';
import { hasPermission } from '../../services/permissions.js';
import { listNotifications, unreadCount } from '../../services/notifications.js';
import { getUserStats, recentLogins } from '../../services/users.js';
import { contextFromRequest, httpError } from '../shared/acl.js';
import { recent as recentNodes, usageOf } from '../files/service.js';
import { getHome as kbHome } from '../kb/service.js';
import { contextFromRequest as kbContext } from '../kb/access.js';
import { startOfDay } from '../../services/datetime.js';
import { WIDGETS } from './widgets.js';
import { requestZone } from '../../services/regional.js';

/*
 * Data behind each widget. Every provider reads through the owning module's
 * own service with the person's context, so a widget never shows more than
 * the module itself would. Day boundaries follow the person's zone (an
 * explicit `tz` from the browser, else their region settings).
 */

const DAY = 24 * 3600 * 1000;

const AREA_PATHS = { notifications: '/notifications', 'admin.users': '/admin/users' };

/**
 * Whether the request may read an area (a module id, 'notifications',
 * 'admin.users'): an API token needs the scope it would need to call that
 * area's API directly; session requests (no token) always may.
 */
export function areaAllowed(req, area) {
  const policy = req?.apiToken?.policy;
  if (!policy || !area) return true;
  return decide(policy, 'GET', AREA_PATHS[area] || `/app/${area}`).ok;
}


const int = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Start of today, tomorrow and of the day `days - 1` ago in the person's zone, as instants (DST safe). */
export function bounds(tz, days = 1, now = new Date()) {
  return { today: startOfDay(now, tz), tomorrow: startOfDay(now, tz, 1), since: startOfDay(now, tz, -(days - 1)) };
}

/** "YYYY-MM-DD" for each of the last `days` days in the zone, oldest first. */
function dayKeys(today, days, tz) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) keys.push(fmt.format(new Date(new Date(today).getTime() - i * DAY + 12 * 3600 * 1000)));
  return keys;
}

const seriesOf = (keys, rows, field = 'count') => {
  const map = new Map(rows.map((row) => [row.day, Number(row[field])]));
  return keys.map((key) => map.get(key) || 0);
};

// ── Files and knowledge base ────────────────────────────────────────────────

async function recentFiles(req, settings) {
  const ctx = contextFromRequest(req, 'files.admin');
  const limit = int(settings.limit, 3, 20, 6);
  const [items, usage] = await Promise.all([recentNodes(ctx), usageOf(ctx.userId)]);
  return {
    usage,
    items: items.slice(0, limit).map((node) => ({ id: node.id, name: node.name, ext: node.file?.ext, size: node.file?.size, updatedAt: node.updatedAt })),
  };
}

async function kbRecent(req, settings) {
  const home = await kbHome(kbContext(req));
  return {
    items: home.recent.slice(0, int(settings.limit, 3, 12, 6)).map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      file: item.file ? { ext: item.file.ext } : null,
      updatedAt: item.updatedAt,
      author: item.author,
    })),
  };
}

// ── People (console) and personal ───────────────────────────────────────────

async function people(req, settings, tz) {
  const days = int(settings.period, 7, 90, 14);
  const { today, since } = await bounds(tz, days);
  const [stats, logins, joined, last] = await Promise.all([
    getUserStats(),
    query(
      `SELECT to_char(created_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day,
              COUNT(*) FILTER (WHERE success)::int AS ok, COUNT(*) FILTER (WHERE NOT success)::int AS failed
       FROM login_attempts WHERE created_at >= $1 GROUP BY 1`,
      [since, tz]
    ),
    query(`SELECT COUNT(*)::int AS count FROM users WHERE created_at >= $1`, [since]),
    recentLogins(5),
  ]);
  const keys = dayKeys(today, days, tz);
  return {
    total: stats.total,
    active30d: stats.active30d,
    blocked: stats.blocked,
    disabled: stats.disabled,
    groups: stats.groups,
    joined: joined.rows[0].count,
    days: keys,
    logins: seriesOf(keys, logins.rows, 'ok'),
    failed: seriesOf(keys, logins.rows, 'failed'),
    recent: last.map((user) => ({ id: user.id, name: user.displayName || user.username, avatarUrl: user.avatarUrl || null, at: user.lastLoginAt })),
  };
}

async function notifications(req, settings) {
  return listNotifications(req.user.id, { limit: int(settings.limit, 3, 20, 6), unreadOnly: Boolean(settings.unreadOnly) });
}

async function welcome(req) {
  return areaAllowed(req, 'notifications') ? { unread: await unreadCount(req.user.id) } : {};
}

export const PROVIDERS = {
  welcome,
  notifications,
  recentFiles,
  kbRecent,
  people,
};

/** Runs a widget's provider if this person may use the widget. */
export async function widgetData(req, type, input = {}) {
  const def = WIDGETS[type];
  const provider = PROVIDERS[type];
  if (!def || !provider) throw httpError(404, 'Unknown widget', 'NOT_FOUND');
  const modules = (await getSettingsView()).modules;
  if (def.module && !modules[def.module]?.enabled) throw httpError(404, 'Module is disabled', 'MODULE_DISABLED');
  if (def.permission && !hasPermission(req.access?.permissions || [], def.permission)) throw httpError(403, 'You do not have permission for this widget', 'FORBIDDEN');
  const area = def.area || def.module;
  if (!areaAllowed(req, area)) throw httpError(403, `The token lacks the ${area}:read scope`, 'SCOPE_DENIED');
  let settings = {};
  try {
    settings = input.settings ? JSON.parse(input.settings) : {};
  } catch {
    settings = {};
  }
  // Day boundaries: the zone the browser sent when valid, else the person's region zone.
  return provider(req, settings && typeof settings === 'object' ? settings : {}, await requestZone(req, input.tz), input);
}

/** Choices for widget settings (lists a widget's settings form picks from). None yet; add them per module. */
export async function widgetOptions() {
  return {};
}
