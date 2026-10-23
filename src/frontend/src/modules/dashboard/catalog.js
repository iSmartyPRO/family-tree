import { Clock, CLOCK_ZONES, NOTE_COLORS, Note, Notifications, QuickActions, Welcome } from './widgets/Personal';
import { KbRecent, People, RecentFiles } from './widgets/Content';
import { getRegional } from '../../lib/datetime';

/*
 * Frontend widget catalog. Each entry: the component, where it sits in the
 * gallery, its colour and icon, sizes (12-column grid, rows of ~56 px), the
 * module page it links to, a preview sketch for the gallery and the settings
 * form. `fit`: on phones the card is as tall as its content (lists, tiles);
 * without it the card keeps its rows (charts, calendars). The server keeps the matching list (modules/dashboard/widgets.js).
 *
 * Field types: segmented, select, multi, switch, number, zones, color.
 * `from` loads choices from /options (modules; a module adds its own lists there).
 */

export const CATEGORIES = ['overview', 'content', 'admin', 'tools'];

const period = (values = [7, 30, 90], fallback = 30) => ({ key: 'period', type: 'segmented', default: fallback, options: values.map((value) => ({ value, labelKey: 'dashboard.fields.days', n: value })) });
const limit = (fallback, min = 3, max = 20) => ({ key: 'limit', type: 'number', default: fallback, min, max });

export const WIDGET_CATALOG = {
  welcome: {
    Component: Welcome,
    category: 'overview',
    icon: 'home',
    color: '#6366F1',
    size: { w: 8, h: 3, minW: 4, minH: 2, maxH: 4 },
    preview: 'hero',
    bare: true,
    autoHeight: true,
    fields: [{ key: 'showStats', type: 'switch', default: true }],
  },
  quickActions: {
    Component: QuickActions,
    category: 'overview',
    icon: 'apps',
    color: '#0EA5E9',
    fit: true,
    size: { w: 4, h: 3, minW: 2, minH: 2 },
    preview: 'tiles',
    fields: [
      { key: 'modules', type: 'multi', from: 'modules', allowEmpty: 'dashboard.fields.allModules' },
      { key: 'style', type: 'segmented', default: 'tiles', options: ['tiles', 'list'].map((value) => ({ value, labelKey: `dashboard.fields.style.${value}` })) },
    ],
  },
  notifications: {
    Component: Notifications,
    category: 'overview',
    icon: 'bell',
    color: '#EF4444',
    fit: true,
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    preview: 'list',
    fields: [{ key: 'unreadOnly', type: 'switch', default: false }, limit(6, 3, 20)],
  },
  recentFiles: {
    Component: RecentFiles,
    module: 'files',
    category: 'content',
    icon: 'folder',
    color: '#3B82F6',
    link: '/app/files/recent',
    fit: true,
    size: { w: 4, h: 5, minW: 3, minH: 3 },
    preview: 'files',
    fields: [{ key: 'showUsage', type: 'switch', default: true }, limit(6, 3, 20)],
  },
  kbRecent: {
    Component: KbRecent,
    module: 'kb',
    category: 'content',
    icon: 'graduation',
    color: '#0EA5E9',
    link: '/app/kb',
    fit: true,
    size: { w: 4, h: 6, minW: 3, minH: 3 },
    preview: 'list',
    fields: [limit(6, 3, 12)],
  },
  people: {
    Component: People,
    permission: 'users.view',
    category: 'admin',
    icon: 'people',
    color: '#EC4899',
    link: '/admin/users',
    size: { w: 6, h: 5, minW: 4, minH: 4 },
    preview: 'columns',
    fields: [period([7, 14, 30, 90], 14)],
  },
  clock: {
    Component: Clock,
    category: 'tools',
    icon: 'globe',
    color: '#0D9488',
    fit: true,
    size: { w: 3, h: 3, minW: 2, minH: 2 },
    preview: 'clock',
    fields: [
      { key: 'zones', type: 'zones', options: CLOCK_ZONES, default: ['Europe/Moscow', 'Europe/London'] },
      // A new clock starts with the person's time format (regional settings).
      {
        key: 'format',
        type: 'segmented',
        get default() {
          return getRegional().timeFormat === '12' ? '12' : '24';
        },
        options: ['24', '12'].map((value) => ({ value, labelKey: `dashboard.fields.format.${value}` })),
      },
      { key: 'analog', type: 'switch', default: false },
    ],
  },
  note: {
    Component: Note,
    category: 'tools',
    icon: 'file',
    color: '#F59E0B',
    size: { w: 3, h: 3, minW: 2, minH: 2 },
    preview: 'note',
    bare: true,
    fields: [{ key: 'color', type: 'color', options: NOTE_COLORS, default: NOTE_COLORS[0] }],
  },
};

/** Settings with every field's default filled in. */
export function withDefaults(type, settings = {}) {
  const def = WIDGET_CATALOG[type];
  const out = { ...settings };
  (def?.fields || []).forEach((field) => {
    if (out[field.key] === undefined && field.default !== undefined) out[field.key] = field.default;
  });
  return out;
}
