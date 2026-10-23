---
name: start-new-project
description: Use when turning this skeleton into a concrete product — renaming, branding, landing page texts, Docker/env names, first modules, deployment. Also when the user asks "с чего начать новый проект на этом скелете".
---

# Новый проект на скелете

Подробно — `docs/adapt.md`, `docs/getting-started.md`, `docs/configuration.md`, `docs/postgres-setup.md`.

## 1. Имя и окружение
- `.env.example` → `.env` (`make env` заполнит секреты): `DOCKER_NAME`, `DOCKER_PORT`, `FRONTEND_URL`, `POSTGRES_DB`, `POSTGRES_USER`.
- `VERSION`, `name` в `src/backend/package.json` и `src/frontend/package.json`, `README.md`.
- Значения по умолчанию названия/описания — `DEFAULTS.app_name`, `app_description` в `src/backend/services/settings.js`;
  в работающем портале — Настройки → Общие (там же логотипы).
- Бренд в текстах: `src/frontend/src/locales/<lang>/_root.js` (`brand`), `components/AppFooter.jsx`, `public/favicon.svg`, `index.html`.
- Cookie `da_session` (`src/backend/config/app.js`) — смена разлогинит всех.

## 2. Главная-одностраничник
`src/frontend/src/pages/Home.jsx` — разделы `#features`, `#how`, `#faq`, `#contact`; все тексты — в
`locales/<lang>/landing.js` (5 языков, одинаковая структура массивов). Иконки карточек — имена из `components/icons/menuIcons.jsx`.
Стили — блок «Landing» в `src/frontend/src/index.css`, только токены `--da-*`. Новый раздел: добавить id в `SECTIONS`,
секцию в JSX и тексты `landing.<id>.*`, пункт `landing.nav.<id>`.
Режим доступа «Открытый» показывает главную гостям; «Закрытый» — сразу вход (Настройки → Доступ к сайту).

## 3. Вид
Цветовые шаблоны — `src/frontend/src/theme/templates.js`, шрифты — `theme/typography.js`, иконки — `components/icons/`.

## 4. Предметная область
Каждый bounded context — отдельный модуль (скилл `new-module`). Ненужные готовые модули (дашборд, файлы, база знаний,
робот) можно выключить в Настройки → Модули или удалить (скилл `remove-module`; база знаний хранит вложения в «Файлах»).

## 5. Запуск
```bash
make setup      # .env + сеть docker-lan
make postgres-up  # если нужен общий PostgreSQL из Makefile
make rebuild && make health
```
TLS — перед `DOCKER_PORT` (обратный прокси), `FRONTEND_URL=https://…`, `TRUST_PROXY_HOPS` по числу прокси.
