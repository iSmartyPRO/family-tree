---
name: i18n
description: Use whenever adding, changing or removing any user-visible text (UI labels, messages, emails, notifications, help) or a language. The portal ships 5 languages (en, ru, ky, tr, zh) that must stay in sync, and tests/CI fail on gaps or extra keys.
---

# Тексты и переводы

Полное руководство — `docs/i18n.md`, словарь терминов — `docs/i18n-glossary.md`.

## Где лежат тексты

| Что | Где | Как вызывать |
|---|---|---|
| Интерфейс | `src/frontend/src/locales/<lang>/<ns>.js` — один файл на верхний ключ | `const { t } = useLocale(); t('ns.key', { name })` |
| Сервер (письма, уведомления, превью) | `src/backend/locales/<lang>/<ns>.js` | `tr(locale, 'ns.key', params)` из `services/i18n/index.js` |
| Справка | `src/frontend/src/help/content/<lang>/<id>.js`, `help/admin/<lang>/<id>.js` | скилл `help-and-tours` |
| Многоязычные значения в данных (манифест, демо) | объекты `{ en, ru, ky, tr, zh }` | `pick(value, locale)` |

Языки: `en` (эталон), `ru` (основной у пользователей), `ky`, `tr`, `zh`. Реестр — `services/i18n/languages.js`
(общий код с фронтом: `src/frontend/src/i18n/languages.js`, должен совпадать).

## Правила

1. Новый ключ — **во всех пяти** языках, с одинаковой структурой (одинаковые ключи, длины массивов, плейсхолдеры `{name}`).
   Пишем нормальный текст на каждом языке, а не копию английского.
2. Множественное число: суффиксы `_one`, `_few`, `_many`, `_other` (CLDR; для en/tr/ky — `_one`/`_other`, zh — `_other`),
   вызов `t('ns.files', { count })`.
3. Ключ вызывается литералом — `t('files.title')`. Динамические ключи (`t(\`ns.${id}\`)`) допустимы, но проверка их не видит:
   держи все варианты в словаре.
4. Удаляешь фичу — удаляй её ключи во всех языках (иначе мусор; лишние ключи в ru/ky/tr/zh ловит проверка).
5. Не хардкодить строки в JSX/ответах API, кроме кодов ошибок (`code: 'NOT_FOUND'`), которые фронт переводит сам.
6. Файлы локалей — обычные JS-модули `export default { … }`; кавычки внутри строк экранируй (`'Modüller\'den'`)
   или используй типографский апостроф `’`. После правки — `node --check <файл>`.

## Проверка

```bash
cd src/frontend && npm run i18n:check   # покрытие ru/ky/tr/zh, лишние ключи, каждый t('…') есть в en
cd src/backend && node --test test/i18n.test.js test/i18n-qa-fixes.test.js
```
