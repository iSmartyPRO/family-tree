/**
 * Static facts about every module: permissions, default system settings and a
 * pure sanitizer for them. No imports — core services read this without
 * loading module code (and without import cycles).
 */

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/** File type groups an administrator can allow in the knowledge base. */
export const KB_FILE_GROUPS = {
  images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic'],
  pdf: ['pdf'],
  office: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'csv'],
  text: ['txt', 'md', 'json', 'xml', 'log'],
  media: ['mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'm4a'],
  archives: ['zip', '7z', 'rar'],
};

const HEX = /^#[0-9a-f]{6}$/i;

// Characters of the robot assistant (modules/assistant/service.js keeps the same list).
const ASSISTANT_AVATARS = ['pixel', 'orbi', 'kiko', 'classic', 'pro', 'boltik', 'nexus', 'bubbles', 'builder', 'builder2', 'architect', 'doctor', 'girl', 'boy', 'toddler', 'zayka', 'ermek', 'aichurok', 'berkut', 'jibek', 'volt', 'nova', 'shadow', 'aurora', 'barsik', 'ryzhik', 'bao', 'pingo'];

export const MODULE_CATALOG = [
  {
    id: 'files',
    defaultEnabled: true,
    permissions: ['files.admin'],
    defaults: {
      maxUploadMb: 200,
      // Personal storage per user (0 = unlimited).
      quotaMb: 0,
      fileGroups: Object.keys(KB_FILE_GROUPS),
      // Any extension, beyond the groups above (served as downloads only).
      allowAny: true,
      publicLinks: true,
      requireLinkPassword: false,
      maxLinkDays: 0,
      // Public links that let visitors upload, rename, replace or delete.
      writeLinks: true,
      requireWriteLinkPassword: false,
      // Total a link that accepts files may take in when it has no quota of its own (MB, 0 = unlimited).
      linkQuotaMb: 2048,
      // Who publishes links: 'owners' (owners and space managers) or 'members'
      // (anyone with access, granting at most their own rights).
      linkSharing: 'owners',
      // Who creates shared spaces: 'everyone' or 'admins' (files.admin).
      spaceCreation: 'admins',
      trashDays: 30,
      // How a file opens: 'page' (its own page with an address) or 'modal' (over the folder).
      openMode: 'page',
    },
    sanitize(current, incoming = {}) {
      const next = { ...current };
      if (incoming.maxUploadMb !== undefined) next.maxUploadMb = clampInt(incoming.maxUploadMb, 1, 4096, 200);
      if (incoming.quotaMb !== undefined) next.quotaMb = clampInt(incoming.quotaMb, 0, 10_000_000, 0);
      if (Array.isArray(incoming.fileGroups)) next.fileGroups = incoming.fileGroups.filter((group) => KB_FILE_GROUPS[group]);
      for (const flag of ['allowAny', 'publicLinks', 'requireLinkPassword', 'writeLinks', 'requireWriteLinkPassword']) {
        if (typeof incoming[flag] === 'boolean') next[flag] = incoming[flag];
      }
      if (incoming.maxLinkDays !== undefined) next.maxLinkDays = clampInt(incoming.maxLinkDays, 0, 3650, 0);
      if (incoming.linkQuotaMb !== undefined) next.linkQuotaMb = clampInt(incoming.linkQuotaMb, 0, 10_000_000, 2048);
      if (['owners', 'members'].includes(incoming.linkSharing)) next.linkSharing = incoming.linkSharing;
      if (incoming.trashDays !== undefined) next.trashDays = clampInt(incoming.trashDays, 1, 365, 30);
      if (['everyone', 'admins'].includes(incoming.spaceCreation)) next.spaceCreation = incoming.spaceCreation;
      if (['page', 'modal'].includes(incoming.openMode)) next.openMode = incoming.openMode;
      return next;
    },
  },
  {
    id: 'dashboard',
    defaultEnabled: true,
    permissions: ['dashboard.admin'],
    defaults: {
      // Heading of the page (empty = "Dashboard").
      title: '',
      // People may rearrange, resize, add and remove widgets for themselves.
      personalize: true,
    },
    sanitize(current, incoming = {}) {
      const next = { ...current };
      if (typeof incoming.title === 'string') next.title = incoming.title.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
      if (typeof incoming.personalize === 'boolean') next.personalize = incoming.personalize;
      return next;
    },
  },
  {
    id: 'kb',
    defaultEnabled: true,
    permissions: ['kb.admin'],
    defaults: {
      defaultIcon: 'folder',
      defaultColor: '#3B82F6',
      maxUploadMb: 50,
      fileGroups: Object.keys(KB_FILE_GROUPS),
      publicLinks: true,
      requireSharePassword: false,
      maxShareDays: 0,
    },
    sanitize(current, incoming = {}) {
      const next = { ...current };
      if (typeof incoming.defaultIcon === 'string' && /^[a-z0-9_-]{2,32}$/i.test(incoming.defaultIcon)) {
        next.defaultIcon = incoming.defaultIcon;
      }
      if (typeof incoming.defaultColor === 'string' && HEX.test(incoming.defaultColor)) {
        next.defaultColor = incoming.defaultColor.toUpperCase();
      }
      if (incoming.maxUploadMb !== undefined) next.maxUploadMb = clampInt(incoming.maxUploadMb, 1, 1024, 50);
      if (Array.isArray(incoming.fileGroups)) {
        next.fileGroups = incoming.fileGroups.filter((group) => KB_FILE_GROUPS[group]);
      }
      for (const flag of ['publicLinks', 'requireSharePassword']) {
        if (typeof incoming[flag] === 'boolean') next[flag] = incoming[flag];
      }
      if (incoming.maxShareDays !== undefined) next.maxShareDays = clampInt(incoming.maxShareDays, 0, 3650, 0);
      return next;
    },
  },
  {
    id: 'family',
    defaultEnabled: true,
    permissions: ['family.admin'],
    defaults: {
      maxPhotoMb: 10,
      publicLinks: true,
      requireSharePassword: false,
      maxShareDays: 0,
    },
    sanitize(current, incoming = {}) {
      const next = { ...current };
      if (incoming.maxPhotoMb !== undefined) next.maxPhotoMb = clampInt(incoming.maxPhotoMb, 1, 50, 10);
      for (const flag of ['publicLinks', 'requireSharePassword']) {
        if (typeof incoming[flag] === 'boolean') next[flag] = incoming[flag];
      }
      if (incoming.maxShareDays !== undefined) next.maxShareDays = clampInt(incoming.maxShareDays, 0, 3650, 0);
      return next;
    },
  },
  {
    id: 'assistant',
    // Not an app with its own page: a helper drawn over every page.
    overlay: true,
    defaultEnabled: true,
    permissions: [],
    // Shown to every signed-in person (public settings), not only administrators.
    publicSettings: ['avatar', 'proactive', 'choice', 'allowed', 'allowColors'],
    defaults: {
      // Robot shown until a person picks their own (one of ASSISTANT_AVATARS).
      avatar: 'pixel',
      // Offer help once when a person opens a section for the first time.
      proactive: true,
      // Who chooses the character: 'all' (any), 'some' (only `allowed`), 'one' (everyone gets `avatar`).
      choice: 'all',
      allowed: [],
      // People may recolour their character.
      allowColors: true,
    },
    sanitize(current, incoming = {}) {
      const next = { ...current };
      if (ASSISTANT_AVATARS.includes(incoming.avatar)) next.avatar = incoming.avatar;
      if (typeof incoming.proactive === 'boolean') next.proactive = incoming.proactive;
      if (typeof incoming.allowColors === 'boolean') next.allowColors = incoming.allowColors;
      if (['all', 'some', 'one'].includes(incoming.choice)) next.choice = incoming.choice;
      if (Array.isArray(incoming.allowed)) next.allowed = [...new Set(incoming.allowed.filter((id) => ASSISTANT_AVATARS.includes(id)))];
      // The default must be one people may have; an empty selection means everyone.
      if (next.choice === 'some') {
        if (!next.allowed.length) next.choice = 'all';
        else if (!next.allowed.includes(next.avatar)) next.avatar = next.allowed[0];
      }
      return next;
    },
  },
];

export const MODULE_IDS = MODULE_CATALOG.map((module) => module.id);

/** Stored state merged over defaults: `{ kb: { enabled, settings } }`. */
/** `locale`: the portal language, for modules whose stock settings have per-language texts (localizedDefaults). */
export function resolveModules(stored = {}, { locale } = {}) {
  return Object.fromEntries(
    MODULE_CATALOG.map((module) => {
      const saved = stored[module.id] || {};
      // A copy: callers may change their settings without touching the module-level defaults.
      const defaults = structuredClone(locale && module.localizedDefaults ? module.localizedDefaults(locale) : module.defaults);
      return [
        module.id,
        {
          enabled: module.core ? true : typeof saved.enabled === 'boolean' ? saved.enabled : module.defaultEnabled,
          settings: module.upgrade ? module.upgrade({ ...defaults, ...(saved.settings || {}) }, saved.settings || {}) : { ...defaults, ...(saved.settings || {}) },
        },
      ];
    })
  );
}

export function sanitizeModules(current, incoming = {}) {
  const next = structuredClone(current);
  for (const module of MODULE_CATALOG) {
    const patch = incoming[module.id];
    if (!patch || typeof patch !== 'object') continue;
    if (typeof patch.enabled === 'boolean' && !module.core) next[module.id].enabled = patch.enabled;
    if (patch.settings && typeof patch.settings === 'object') {
      next[module.id].settings = module.sanitize(next[module.id].settings, patch.settings);
    }
  }
  return next;
}
