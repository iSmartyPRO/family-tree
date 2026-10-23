# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.6.0] — 2026-10-19

First public release of iApp-Skeleton — a production-ready starter for web apps.

### Added

- Backend: Express + `pg`; sign-in (password, one-time codes by email / Telegram / WhatsApp, magic links, LDAP / AD, Google, Telegram Login, sign in as), RBAC (users, groups, roles, permissions), settings, setup wizard, access modes, IP filtering, security log, scheduler, demo data, i18n (ru / en / ky / tr / zh), time zones and formats.
- Notifications: in-app, Web Push, email, Telegram, WhatsApp, Mattermost — with per-person preferences and quiet hours.
- Integrations: email (SMTP), Telegram, WhatsApp Gateway, Wazzup, Mattermost, Google, Collabora document editing, Active Directory.
- Public API: tokens acting on behalf of a person, access templates, path rules, signed webhooks (`user.created` / `updated` / `deleted`), request log, developer portal with OpenAPI 3.1.
- Module platform with four reference modules: Dashboard, Files, Knowledge base, Robot assistant (see [docs/modules.md](docs/modules.md)).
- Frontend: admin console, user cabinet, help center, guided tours, PWA, one-page landing (`pages/Home.jsx`, texts in `locales/<lang>/landing.js`).
- Docker packaging: Dockerfile with digest-pinned base images, Compose files, nginx, Makefile; external PostgreSQL.

### Security

- Setup wizard protected by a generated `SETUP_TOKEN`; only the browser that created the administrator can finish it; locked for good afterwards.
- API tokens can never link sign-in identities or end sessions; managing a webhook needs every right of the person it runs as.
- Public links: passwords of 8+ characters, brute-force limits per address (IPv6 by /64) and per link, view-only mode, anonymous requests rate-limited.
- The Node app runs as an unprivileged user inside the container; the dev stack listens on localhost only.
