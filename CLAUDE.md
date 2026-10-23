# CLAUDE.md — iApp-Skeleton, стартовый скелет веб-проекта

Минимальный каркас для быстрого запуска новых проектов: Docker + Express/PostgreSQL backend + React/Vite/antd frontend.
В составе: вход и права, кабинет, админка, мастер первого запуска, интеграции, робот-помощник,
справка и туры, база знаний, файлы, дашборд, одностраничная главная.

Перед работой над задачей загрузи подходящий скилл из `.claude/skills/` — там пошаговые рецепты и чек-листы.

## Карта проекта

```
src/backend/            Express (ESM, Node ≥20), pg без ORM
  server.js             вход; config/ (app, database, paths, version)
  routes/               auth, account, admin, setup, platform, notifications, pwa — ядро
  services/             auth, rbac, permissions, settings, setup, signin, ldap, google, integrations,
                        notifications(+Catalog), security, scheduler, demo, i18n/, linkPreview/, office/ …
  api/                  публичный API: токены, области (scopes.js), вебхуки (events.js), справочник (reference.js)
  modules/              платформа модулей: catalog.js, manifest.js, dependencies.js, index.js (MODULES)
    files/ kb/ dashboard/ assistant/   — модули; shared/ — общие acl/storage/ссылки/демо-хелперы
  locales/<lang>/*.js   серверные тексты (письма, уведомления, превью ссылок)
  test/*.test.js        node:test, без БД (DB-тесты *.db.test.js пропускаются без переменных)
src/frontend/src/
  App.jsx               маршруты, гейты (Setup/Auth/Module), провайдеры
  pages/                Home.jsx (одностраничник), Login, SetupWizard, account/*, admin/*
  admin/                navigation.js (меню и пункты настроек) + settingsPages.js (компоненты)
  modules/              registry.js (страницы модулей), manifest.js (MODULE_UI), shared/moduleTours.js, <id>/
  locales/<lang>/<ns>.js  тексты интерфейса, один файл на верхний ключ
  help/                 центр справки: content/<lang>/<id>.js, admin/<lang>/<id>.js (SCHEMA.md, ADMIN_SCHEMA.md)
  tour/                 движок туров + content/ (portal, dashboard, files, kb, notifications)
  components/ ui/ lib/ context/ layouts/ theme/
docs/                   документация разработчика (начинать с architecture.md, extending.md, modules.md, i18n.md)
Dockerfile, docker-compose*.yml, nginx.conf, Makefile, .env.example
```

## Команды

```bash
make test                             # тесты backend + сборка frontend на хосте
cd src/backend && npm test            # все тесты backend (быстро, без БД)
cd src/backend && npm run check       # синтаксис каждого .js
cd src/frontend && npm run build      # сборка frontend
cd src/frontend && npm run i18n:check # полнота переводов и что каждый t('…') есть в en
make dev                              # dev в Docker: Vite :3020, API :3021
make rebuild && make health           # прод-контейнер
```

PostgreSQL внешний (сеть `docker-lan`, см. docs/postgres-setup.md); подключение можно ввести в мастере `/setup`.

## Правила, которые нельзя нарушать

- **Безопасность** (docs/adapt.md §4): не переписывать без нужды `middleware/auth.js`, `services/rbac.js`, `permissions.js`,
  `signin.js`, `ldap.js`, `auth.js`, `middleware/upload.js`, `ipGuard.js`, заголовки `nginx.conf`. SQL — только параметризованный.
  Никаких изменений состояния на `GET` (CSRF держится на SameSite=Lax). Секреты не попадают в `toPublicSettings()`, логи и ответы.
- **Валидация в сервисе**, не только в UI; настройки модулей — через `sanitize()` в `modules/catalog.js`.
- **Переводы**: каждый новый текст — во всех пяти языках (`en`, `ru`, `ky`, `tr`, `zh`), en — эталон; ключи и структура
  одинаковы во всех языках. Строки в коде не хардкодить, только `t('ns.key')`.
- **Дизайн**: только токены из `index.css` (`--da-primary`, `--da-surface`, `--da-muted`, …) и готовые компоненты
  (`PageHeader`, `SettingsSection`, `SaveBar`, `ModuleHeader`). Никаких разовых цветов — иначе ломаются темы и тёмный режим.
- **Модуль = полный комплект**: backend + catalog + manifest + frontend registry + i18n + справка + тесты (скилл `new-module`).
  Удаляя модуль, убирай его отовсюду (скилл `remove-module`), иначе ломаются тесты i18n/туров.
- **Без имён клиентов** и реальных доменов в коде, демо-данных, тестах и доках.
- Файлы в репозитории с окончаниями CRLF — сохраняй их при правке.

## Перед тем как сказать «готово»

Скилл `verify` — тесты backend, `npm run check`, `i18n:check`, сборка frontend; для UI — запуск и просмотр в браузере.
