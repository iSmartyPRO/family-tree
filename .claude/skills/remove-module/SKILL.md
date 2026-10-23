---
name: remove-module
description: Use when deleting a module or a large feature from the skeleton (e.g. the dashboard, files, kb, assistant, or a module added later). Lists every place a module is wired into, so nothing dangles and tests/i18n stay green.
---

# Удаление модуля

Модуль прописан во многих местах; удалять нужно все, иначе упадут тесты туров/i18n или сервер не стартует
(манифест проверяется при запуске). Сначала найди все упоминания:

```bash
grep -rn "<id>" src/backend src/frontend/src docs README.md --include=*.js --include=*.jsx --include=*.md -l | grep -v node_modules
```

## Backend
- `modules/<id>/` (удалить), `modules/index.js` (импорт и `MODULES`), `modules/catalog.js`, `modules/manifest.js`
  (запись и ссылки `enhances`/`requires` других модулей).
- Импорты из модуля в ядре: проверить `routes/`, `services/`, `api/`, `server.js`.
- `services/notificationCatalog.js` (группа), `api/events.js` (события), `api/scopes.js` (`RESOURCE_KINDS`), `api/templates.js`,
  `api/schema.js` (шаблоны токенов), `api/reference.js` (`SECTIONS`, `DOCS`), `services/linkPreview` (если были публичные ссылки),
  `modules/dashboard/{widgets,data}.js` (виджеты), `routes/pwa.routes.js` (ярлыки), `locales/<lang>/<id>.js`, тесты `test/*<id>*`.
- Таблицы в существующих БД не удаляются автоматически — при необходимости отдельная миграция/ручной `DROP`.

## Frontend
- `modules/<id>/`, `modules/registry.js`, `modules/manifest.js` (`MODULE_UI`), `modules/shared/moduleTours.js`,
  `admin/navigation.js` + `admin/settingsPages.js`, `App.jsx` (маршруты, провайдеры, side-effect импорты),
  `modules/dashboard/catalog.js` и `widgets/*`, `components/Chrome.jsx` (кнопки в шапке).
- Тексты во всех 5 языках: свой namespace + `apps`, `settings`, `permissions`, `api`, `notifyPrefs`, `dashboard`, `tour`, `platform`.
- Справка: `help/content/<lang>/<id>.js`, `help/admin/<lang>/<id>.js`, `HELP_ORDER`, упоминания и `related` в других статьях.
- Тур: `tour/content/<id>.js` (+ `tour/content/index.js`) или `modules/<id>/tour.js`.
- Зависимости npm, которые больше никто не импортирует — убрать из `package.json`.

## Документация
`docs/<id>.md`, `docs/modules.md`, README, ссылки из других docs.

## Проверка
Скилл `verify`. Полезно: поиск относительных импортов на несуществующие файлы и запуск backend на пустой БД
(демо-файлы `modules/*/demo.js` и локали грузятся динамически — их ошибки видны только при старте).
