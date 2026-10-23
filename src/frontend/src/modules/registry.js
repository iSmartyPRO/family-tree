import { lazy } from 'react';
import { canAny } from '../lib/access';
import { lazyPage } from '../lib/lazyPage';

/**
 * Frontend side of the module platform. Each entry is an app reachable at
 * /app/<id>; the backend decides whether it is enabled (settings.modules).
 * Adding a module: an entry here, a backend module, and i18n `apps.<id>.*`.
 * `permission`: the module is listed (launcher, /apps, quick actions) only for
 * people who have it (a list: any of them) — the API enforces it again.
 */
export const MODULE_REGISTRY = [
  {
    id: 'dashboard',
    path: '/app/dashboard',
    icon: 'dashboard',
    labelKey: 'apps.dashboard.name',
    descKey: 'apps.dashboard.desc',
    App: lazyPage(() => import('./dashboard/DashboardApp')),
    Settings: lazy(() => import('./dashboard/DashboardSettings')),
  },
  {
    id: 'files',
    path: '/app/files',
    icon: 'folder',
    labelKey: 'apps.files.name',
    descKey: 'apps.files.desc',
    App: lazyPage(() => import('./files/FilesApp')),
    Settings: lazy(() => import('./files/FilesSettings')),
  },
  {
    id: 'kb',
    path: '/app/kb',
    icon: 'graduation',
    labelKey: 'apps.kb.name',
    descKey: 'apps.kb.desc',
    App: lazyPage(() => import('./kb/KbApp')),
    Settings: lazy(() => import('./kb/KbSettings')),
  },
  {
    id: 'family',
    path: '/app/family',
    icon: 'people',
    labelKey: 'apps.family.name',
    descKey: 'apps.family.desc',
    App: lazyPage(() => import('./family/FamilyApp')),
    Settings: lazy(() => import('./family/FamilySettings')),
  },
];

/**
 * Modules without a page of their own (drawn over every page). They appear in
 * Settings → Modules with an on/off switch and their own settings screen.
 */
export const FEATURE_MODULES = [
  {
    id: 'assistant',
    icon: 'robot',
    labelKey: 'apps.assistant.name',
    descKey: 'apps.assistant.desc',
    Settings: lazy(() => import('./assistant/AssistantSettings')),
  },
];

/** A module's name: the administrator's choice when the module has one (Drive), else the translation. */
export function moduleLabel(module, settings, t) {
  return settings?.modules?.[module.id]?.title || t(module.labelKey);
}

export function moduleById(id) {
  return MODULE_REGISTRY.find((module) => module.id === id) || null;
}

/**
 * Modules switched on in public settings. With `user` (null = signed out), a module
 * with a `permission` is left out unless the person has it; without it (pickers
 * that configure the portal for others) every enabled module is listed.
 */
export function enabledModules(settings, user) {
  return MODULE_REGISTRY.filter((module) => settings?.modules?.[module.id]?.enabled && (user === undefined || !module.permission || canAny(user, [].concat(module.permission))));
}
