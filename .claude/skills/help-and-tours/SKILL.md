---
name: help-and-tours
description: Use when writing or changing in-app documentation — help center articles (/help), the admin «About the module» pages, field hints (<Hint>), the knowledge-base-style guides, or guided tours — and whenever a feature changes so its help stays true. Keeps 5 languages structurally identical.
---

# Справка, подсказки и туры

Справка — часть продукта: при изменении фичи обнови её статью в том же изменении. Руководство — `docs/help.md`,
форматы — `src/frontend/src/help/SCHEMA.md` и `help/ADMIN_SCHEMA.md`.

## Статьи для пользователей — `help/content/<lang>/<id>.js`

- `<id>` = id модуля или страницы ядра (`start`, `account`, `notifications`, `dashboard`, `files`, `kb`, `assistant`, `admin`, `api`).
- Поля: `title`, `tagline`, `summary`, `highlights` (4–6), `tips`, `sections` (`id`, `title`, `body`, `steps`, `example`, `note`),
  `faq`, `fields` (подсказки для `<Hint id="<id>.<key>" />`, у каждой `more: '<section id>'`), `related` (только существующие статьи).
- Разметка — безопасный Markdown-минимум: `**жирный**`, `` `код` ``, списки, `[текст](/внутренний/путь)`. HTML не рендерится.
- `en` — эталон. `ru` — полная копия структуры (те же `id`, `related`). `ky`/`tr`/`zh` — оверлеи по позиции: те же массивы
  той же длины и в том же порядке, недостающее берётся из `en`.
- Порядок оглавления — `HELP_ORDER` в `help/registry.jsx`; какая статья открывается на странице — `helpForPath()` там же.

## «О модуле» для администратора — `help/admin/<lang>/<id>.js`

`purpose`, `audience`, `setup[]`, `roles{}`, `access`, `scenarios[]` — открывается из Настройки → Модули.

## Туры — `src/frontend/src/tour/`

- Формат шага — шапка `tour/engine.js`. Встроенные туры: `tour/content/*.js` + `tour/content/index.js` (`BUILTIN_TOURS`).
- Тур модуля: `modules/<id>/tour.js` → импорт в `modules/shared/moduleTours.js` (`MODULE_TOURS`) → `MODULE_UI.<id>.tour`.
- Тексты — `locales/<lang>/tour.js` → `<tourId>.<stepId>.{title,text}`.
- Каждый `target` шага — якорь `data-tour="<target>"` в JSX. Шаг без якоря на странице движок пропускает, но тест требует,
  чтобы якорь существовал в коде.

## Проверка

```bash
cd src/frontend && npm run i18n:check
cd src/backend && node --test test/tours.test.js test/tours-coverage.test.js test/i18n.test.js
```
