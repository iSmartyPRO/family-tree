---
name: new-module
description: Use when adding a new module/app/section to the portal (e.g. "добавь модуль заказов", "new page /app/orders", a bounded context with its own tables, API and UI). Gives the full checklist so no wiring is forgotten — backend descriptor, catalog, manifest, routes, frontend registry, settings screen, i18n in 5 languages, help, tours, dashboard widget, notifications, webhooks, tests.
---

# Новый модуль

Модуль — папка `src/backend/modules/<id>/` + папка `src/frontend/src/modules/<id>/`, подключённые к платформе.
Пользователи, роли, настройки, тема, навигация, справка и API-токены подхватывают модуль сами, если он прописан везде ниже.
Образцы: `kb` (полный модуль с публичными ссылками), `dashboard` (виджеты), `assistant` (минимальный, оверлей без страницы).
Подробности: `docs/modules.md`, `docs/extending.md` («Module manifest», «Demo data», «Admin docs», «Guided tours»).

`<id>` — короткий латинский id (`orders`): он же URL `/app/<id>`, API `/api/app/<id>`, область токенов и префикс прав `<id>.admin`.

## Backend

1. `modules/<id>/schema.js` — `export async function ensure<Id>Schema()` с `CREATE TABLE IF NOT EXISTS …` (идемпотентно,
   выполняется при каждом старте). Внешние ключи на `users(id)` — `ON DELETE CASCADE` или `SET NULL` осознанно.
2. `modules/<id>/service.js` — логика и **валидация входа** (обрезка строк, `clampInt`, белые списки). Только параметризованный SQL.
3. `modules/<id>/routes.js` — `export function privateRoutes() { const router = Router(); … return router; }`;
   обработчики через `wrap()` из `modules/shared/acl.js`; права — `requirePermission('<id>.admin')` из `middleware/auth.js`
   или собственная модель доступа (`modules/shared/acl.js`: `contextFromRequest`, `levelOn`). Изменения состояния — только POST/PUT/DELETE.
   Публичный (анонимный) роутер — `publicRoutes` + `publicPrefix` (пример: kb → `/s`).
4. `modules/<id>/index.js` — дескриптор `export default { id, schema, routes: privateRoutes /*, publicRoutes, publicPrefix */ }`.
5. `modules/index.js` — импорт и добавление в `MODULES` (порядок важен, если таблицы ссылаются на таблицы другого модуля).
6. `modules/catalog.js` → `MODULE_CATALOG`: `{ id, defaultEnabled, permissions: ['<id>.admin'], defaults: {…}, sanitize(current, incoming) }`.
   `sanitize` чистая и проверяет каждое поле. `overlay: true` — модуль без страницы; `core: true` — нельзя выключить.
7. `modules/manifest.js` → `MODULE_MANIFEST.<id>`: `name {en,ru,ky,tr,zh}`, `version: '1.0.0'`, `category` (из `CATEGORIES`),
   `minCore`, `requires`, `enhances`, `docs: { user: '<id>', guide: 'docs/<id>.md' }`, `changelog`. Проверяется при старте —
   ошибка в манифесте роняет сервер.
8. Опционально:
   - демо-данные `modules/<id>/demo.js` → `registerDemo({ module, describe, seed, purge })` (грузится автоматически);
   - фоновые задачи `registerJob()` из `services/scheduler.js`;
   - уведомления: группа в `services/notificationCatalog.js` → `NOTIFICATION_GROUPS` + `notify()` из `services/notifications.js`;
   - вебхуки: события в `api/events.js` → `EVENT_CATALOG` (`{ type: 'order.created', area: '<id>' }`) + `emitEvent()`;
   - виджет дашборда: `modules/dashboard/widgets.js` (`WIDGETS`, `DEFAULT_LAYOUT`) + провайдер в `modules/dashboard/data.js` (`PROVIDERS`);
   - описание эндпоинтов для справочника API: `api/reference.js` (`SECTIONS`, `DOCS`);
   - «Следить» за записями: `SUBSCRIPTION_TYPES` в `services/notifications.js` + `canFollow()` в `routes/account.routes.js`;
   - тексты писем/уведомлений сервера: `src/backend/locales/<lang>/<id>.js` (namespace = имя файла).

## Frontend

1. `modules/<id>/<Id>App.jsx` — маршруты под `/app/<id>/*`; шапка — `ModuleHeader` (`modules/shared`), стили — только токены `--da-*`.
2. `modules/<id>/<Id>Settings.jsx` — экран настроек модуля (образец `modules/kb/KbSettings.jsx`, `useAdminSettings`, `SaveBar`).
3. `modules/registry.js` → `MODULE_REGISTRY` (или `FEATURE_MODULES` для оверлея):
   `{ id, path: '/app/<id>', icon, labelKey: 'apps.<id>.name', descKey: 'apps.<id>.desc', App: lazyPage(…), Settings: lazy(…) }`.
4. `modules/manifest.js` → `MODULE_UI.<id> = { tour: null | '<id>' }`.
5. `admin/navigation.js` → пункт в группе `modules` (`{ id: '<id>', defaultIcon, permission: '<id>.admin', keywords }`)
   и `admin/settingsPages.js` → `<id>: lazy(() => import('../modules/<id>/<Id>Settings'))`.
6. Иконка — имя из `components/icons/menuIcons.jsx` (`ICON_CATALOG`), новую добавлять туда же.

## Тексты (все 5 языков: en, ru, ky, tr, zh — см. скилл `i18n`)

- `locales/<lang>/apps.js` → `<id>: { name, desc }`
- `locales/<lang>/settings.js` → `<id>: { title, desc }`
- `locales/<lang>/permissions.js` → `groups.module_<id>` и `<id>_admin: { title, desc }` (точки в правах → `_`)
- `locales/<lang>/api.js` → `areas.<id>` (если модуль виден в областях токенов) и `events.<type_with_underscores>`
- `locales/<lang>/notifyPrefs.js` → `groups.<key>`, `events.<kind_with_underscores>` (если есть уведомления)
- `locales/<lang>/dashboard.js` → `widgets.<type>: { name, desc }` (если есть виджет)
- свой namespace `locales/<lang>/<id>.js` для текстов страницы.

## Справка и туры (скилл `help-and-tours`)

- `help/content/<lang>/<id>.js` (статья для пользователей) + `<id>` в `HELP_ORDER` (`help/registry.jsx`);
- `help/admin/<lang>/<id>.js` (страница «О модуле» в админке);
- тур: `modules/<id>/tour.js` + регистрация в `modules/shared/moduleTours.js` + `MODULE_UI.<id>.tour` + тексты в
  `locales/<lang>/tour.js` + `data-tour="…"` якоря в JSX. Без тура — добавить id в `WITHOUT_TOUR` в `backend/test/tours-coverage.test.js` с причиной.

## Тесты и документация

- `src/backend/test/<id>.test.js` — чистые функции: `sanitize`, валидаторы, политики доступа (без БД).
- `docs/<id>.md` + строка в `docs/modules.md` и README.
- Затем скилл `verify`.
