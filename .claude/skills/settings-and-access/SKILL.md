---
name: settings-and-access
description: Use when adding a stored setting, a settings screen, an admin or cabinet page, a permission/role, a sign-in method, an integration (email, Telegram, WhatsApp, Google, AD…), an API endpoint or a webhook event. Covers where each piece is registered and the security rules for it.
---

# Настройки, права, страницы, интеграции, API

Рецепты с кодом — `docs/extending.md`, модель доступа — `docs/access-control.md`, интеграции — `docs/integrations.md`,
публичный API — `docs/public-api.md`.

## Хранимая настройка
`services/settings.js`: значение по умолчанию в `DEFAULTS`/группе, санитайзер (обрезка, диапазоны, белые списки),
публичная часть — только через `toPublicSettings()` (никаких секретов!). Настройки модуля — `modules/catalog.js` (`defaults` + `sanitize`).
Секреты (токены, пароли) хранить запечатанными (`services/crypto.js`), в ответах — только признак «задано».

## Экран настроек
Пункт в `admin/navigation.js` (`SETTINGS_GROUPS`) → компонент в `admin/settingsPages.js` → тексты `settings.<id>.{title,desc}`.
Экран: `PageHeader`/`SettingsPageHeader`, `SettingsSection`, `SettingRow`, `SaveBar`, хук `useSettingsForm` / `useAdminSettings`.

## Страницы
- Админка верхнего уровня: `ADMIN_PAGES` в `admin/navigation.js` + маршрут в `App.jsx` (палитра ⌘K и иконки подхватятся сами).
- Кабинет: `layouts/AccountLayout.jsx` (меню) + маршрут `/account/*` в `App.jsx`.
- Публичная страница: маршрут в `App.jsx` и проверка `accessMode` (`AccessGate`).

## Право
1. `PERMISSION_CATALOG` в `services/permissions.js` (права модуля — `permissions` в `modules/catalog.js`), при необходимости — во встроенные роли (`services/rbac.js`).
2. Маршрут: `requirePermission('x.y')` (`middleware/auth.js`). UI: `useAuth().can('x.y')`, `permission` в пункте навигации.
3. Тексты: `permissions.x_y.{title,desc}`, новая группа — `permissions.groups.<group>`.
Не ослаблять правила эскалации и защиту последнего суперадминистратора в `rbac.js`.

## Интеграция / способ входа
Конфигурация и «Проверить соединение» — `services/integrations.js`, экран — `pages/admin/settings/Integration.jsx` (общий),
список — `INTEGRATIONS` в `modules/manifest.js`; способы входа — `services/signin.js`, `ldap.js`, `google.js`.
По умолчанию выключено; живые токены не коммитить.

## API-эндпоинт и вебхук
- Модульный API автоматически попадает в справочник и области токенов; описание — `api/reference.js` (`DOCS`).
- Событие вебхука — `api/events.js` (`EVENT_CATALOG`) + `emitEvent(type, { data, visible })` + текст `api.events.<type_underscored>`.
- Новая область токенов вне модулей — `AREAS` в `api/scopes.js`; закрытые для токенов пути — `BLOCKED` там же.

## Обязательные правила
Параметризованный SQL; строки пользователя ограничены по `user_id`; нет изменений на `GET`; валидация в сервисе;
загрузки — через `middleware/upload.js` (расширение + magic bytes). Тест на санитайзер/политику — в `src/backend/test/`.
