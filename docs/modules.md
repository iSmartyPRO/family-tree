# Modules (apps)

The skeleton is a platform for **modules**: self-contained applications that plug into the same users, roles, settings, theme and navigation. Built in: [Dashboard](dashboard.md), [Files](files.md), [Knowledge Base](knowledge-base.md), [Family tree](family.md) and the [Robot assistant](assistant.md) (an overlay module without a page of its own). They are reference implementations — copy their structure when you add the domain modules of your project. Modules notify people through the shared [notification center](notifications.md), can schedule background work with `registerJob()`, and publish webhook events with `emitEvent()` (see [Public API](public-api.md#for-module-authors)). Their endpoints appear in the API reference and get their own token area automatically.

| URL | What it is |
|-----|------------|
| `/apps` | Launcher with every enabled module (also the 9-dot menu in the top bar) |
| `/app/<id>` | A module's UI, e.g. `/app/kb` |
| `/api/apps` | Enabled modules for the signed-in user |
| `/api/app/<id>/…` | A module's private API (signed-in users only) |
| `/api/<publicPrefix>/…` | Optional anonymous API, e.g. `/api/s/…` for public links |
| `/s/<slug>` | Public pages, when a module provides them |

## Turning modules on and off

**Admin → Settings → Modules** shows the **core** services (always on) and every module **by category** (`CATEGORIES` in `modules/manifest.js`: Work, Documents, Sales, Supply, People, Infrastructure — the shipped modules use Work and Documents). Each card has the module's icon, name, **version**, status (*On* / *Off* / *Needs X* / *Always on*), what it **needs** and what it **works with**, a switch, and the buttons *Documentation* («О модуле», `/admin/modules/<id>/docs`), *Settings*, *Demo data* (superadministrators) and *Tour* (when the module has one). A search field and *All / On / Off* filter the list. The permission `settings.modules` is needed to switch modules.

**Requirements** (`requires` in the [manifest](extending.md#module-manifest)) are enforced by the server:

- switching on a module whose required module is off answers `409 MODULE_REQUIRES` with `info.missing` — the page asks «Для X нужны Y. Включить вместе?» and repeats the request with `alsoEnable: true`, which switches the whole chain on;
- a required **integration** that is off cannot be switched on from here (`canAlsoEnable: false`; the dialog points to the integration);
- switching off a module that switched-on modules require answers `409 MODULE_REQUIRED_BY` with `info.dependents` («Нельзя выключить X: от него зависят …»).

Optional links (`enhances`) never block anything: the feature simply hides, and `<ModuleHint>` tells people inside the module which module to switch on.

The shipped modules have no hard requirements; every link between them is optional:

| Module | Needs | Works with (optional) |
|---|---|---|
| Knowledge base | — | Files, document server (integration) |
| Family tree | — | — |
| Files | — | document server (integration) |
| Dashboard | — | Files, Knowledge base (and every module with widgets) |
| Robot assistant | — | — |

A hypothetical `orders` module that cannot work without Files would declare `requires: [{ id: 'files', reason: { en, ru } }]`; one that only adds a dashboard widget when Files is on would use `enhances` instead.

- **Enabled** modules appear in `/apps`, in the launcher and in the top bar.
- **Disabled** modules are invisible: the UI redirects to `/apps`, and every API route, public links included, answers `404 MODULE_DISABLED`. Data is kept, so turning a module back on restores everything.

Each module can add its own settings screen under *Settings → Modules* (for example *Knowledge base*).

Module state is stored in `app_settings` under the key `modules`:

```json
{ "kb": { "enabled": true, "settings": { "defaultColor": "#3B82F6", "maxUploadMb": 50 } } }
```

Public settings (`GET /api/settings`) expose only `{ "<id>": { "enabled": true } }`. The module settings themselves are admin-only.

## Anatomy of a module

```
src/backend/modules/
├── catalog.js           # static facts: id, default settings, sanitize(), permissions
├── manifest.js          # version, category, requires, enhances, minCore, changelog
├── dependencies.js      # switching on/off with requirements (409 rules)
├── index.js             # registry: mounts routes, runs schemas, validates manifests, loads <id>/demo.js
└── kb/
    ├── index.js         # descriptor { id, schema, routes, publicRoutes, publicPrefix }
    ├── demo.js          # optional: registerDemo({ module, seed, purge }) — demo data
    ├── schema.js        # tables (idempotent) + one-time seed
    ├── routes.js        # Express routers
    └── …                # services

src/frontend/src/modules/
├── registry.js          # { id, path, icon, labelKey, descKey, App, Settings }
└── kb/
    ├── KbApp.jsx        # routes under /app/kb/*
    ├── KbSettings.jsx   # settings screen under /admin/settings/kb
    └── …
```

### Backend contract

```js
// src/backend/modules/<id>/index.js
export default {
  id: 'orders',                // URL id: /app/orders, /api/app/orders
  schema: ensureOrdersSchema,  // async, idempotent; runs on every start
  routes: privateRoutes,       // () => Router, mounted behind requireAuth
  publicRoutes,                // optional () => Router for anonymous visitors
  publicPrefix: '/o',          // where publicRoutes live under /api
};
```

The registry wraps every router with `enabledOnly(id)`, and wraps the private router with `requireAuth` as well. Inside the routes, check permissions or the module's own access model. The `req.user` object carries `permissions`, `roleIds` and `groupIds`.

### Catalog entry

`modules/catalog.js` holds static data with **no imports**, so the core settings and permission services can read it without loading module code:

```js
{
  id: 'orders',
  defaultEnabled: false,
  permissions: ['orders.admin'],         // added to the permission catalog (group module_orders)
  defaults: { ordersPerPage: 50 },
  sanitize(current, incoming) { … },     // pure; returns the next settings object
}
```

Unknown keys in a settings patch are ignored. Each field is validated by `sanitize`.

`core: true` marks a module that can never be switched off: it is always enabled and Settings → Modules shows *Always on* instead of a switch (none of the shipped modules uses it).

### Frontend

1. Add an entry to `src/frontend/src/modules/registry.js`. `App` and `Settings` should be `lazy()` so the module stays out of the main bundle.
2. Add a settings item to `admin/navigation.js` (group `modules`), then map it in `admin/settingsPages.js`.
3. Add the module's UI parts (icon, settings screen, admin docs, tour) to `MODULE_UI` in `src/frontend/src/modules/manifest.js`; a guided tour lives in `modules/<id>/tour.js` and is listed in `MODULE_TOURS` (`modules/shared/moduleTours.js`).
4. Add i18n keys `apps.<id>.name`, `apps.<id>.desc` and the permission label in every language (see [i18n](i18n.md)). Keep EN and RU in parity at least.

Routing is automatic. `App.jsx` mounts `${path}/*` behind `SetupGate`, `AuthGate` and `ModuleGate`.

## Checklist for a new module

- [ ] `modules/<id>/` with descriptor, schema, routes
- [ ] Catalog entry with defaults and `sanitize`
- [ ] Manifest entry (`modules/manifest.js`): version 1.0.0, category, requires / enhances, minCore, changelog
- [ ] Admin docs `help/admin/<lang>/<id>.js` and user help `help/content/<lang>/<id>.js`
- [ ] Demo data `modules/<id>/demo.js` (optional, recommended)
- [ ] Added to `MODULES` in `modules/index.js`
- [ ] Frontend registry entry, settings page, navigation item
- [ ] EN + RU translations
- [ ] Unit tests for pure logic (`src/backend/test/`)
- [ ] Docs page in `docs/` and a line in the README
