---
name: verify
description: Use before saying a change is done — runs the backend tests, syntax check, i18n check and frontend build, and for UI/runtime changes starts the app against a throwaway PostgreSQL and looks at it in the browser.
---

# Проверка изменений

## Всегда

```bash
cd src/backend && npm test             # node:test, без БД; *.db.test.js пропускаются без переменных
cd src/backend && npm run check        # node --check каждого .js
cd src/frontend && npm run i18n:check  # должно закончиться «i18n:check passed»
cd src/frontend && npm run build       # Vite; ошибки импорта видны здесь
```

`npm run check` не ловит ошибки в файлах, которые грузятся динамически (локали, `modules/*/demo.js`), если они
синтаксически валидны, но падают при импорте — поэтому для заметных изменений backend запусти сервер.

## Запуск на временной БД (UI, схема, роуты)

```bash
docker run -d --name skel-verify-pg -e POSTGRES_USER=skel -e POSTGRES_PASSWORD=skelpass -e POSTGRES_DB=skel -p 55432:5432 postgres:16-alpine
# env-файл вне репозитория: POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_DB/USER/PASSWORD, JWT_SECRET, PORT=3101,
# FRONTEND_URL=http://localhost:3100, UPLOAD_DIR=<временная папка>
cd src/backend && ENV_FILE_PATH=/path/to/test.env node server.js
cd src/frontend && VITE_API_URL=http://localhost:3101 npx vite --port 3100
```

Первый запуск: мастер `/setup` (или `POST /api/setup/complete` с тестовым администратором, затем `POST /api/setup/access`).
Посмотреть: главную `/`, вход, `/app/<модуль>`, `/admin/settings/modules`, консоль браузера и лог сервера (нет 500).
После проверки: остановить процессы и `docker rm -f skel-verify-pg`.

## Docker-образ (перед релизом)

```bash
make build && make up && make health && make ready
```

В отчёте пиши, что проверено и что нет (например, «DB-тесты не запускались»).
