# Dashboard

`/app/dashboard` — a personal page of widgets over the other modules: files, knowledge base materials, notifications, people and personal helpers (clock, note). It can be the site's home page (**Settings → Site access → Home page**).

## For people

- **Starting set.** Until someone arranges their own, they see the starting layout: greeting, quick access, notifications, knowledge base, recent files, world clock, and for administrators users and sign-ins. Widgets of modules that are off, or that the person may not use, are left out and the grid closes the gaps.
- **Customize** turns on edit mode: drag a widget by its header, pull the bottom-right corner to resize (snaps to the 12-column grid; the size shows while dragging), ⚙ for settings, ⋯ for size presets (small, medium, large, wide, full width), duplicate, open the module, remove (with undo). Everything is saved automatically.
- **Add widget** opens a gallery by category with search and previews. The same widget can be added several times with different settings (for example two clocks with different cities).
- **Settings** of each widget: an own title plus its options — how many items, clock cities and format, note colour and so on.
- **Reset** returns the starting set.
- Layout: 12 columns on wide screens, 6 on tablets, one column on phones.

## Widgets

| Widget | Module | Shows |
|--------|--------|-------|
| Greeting | — | Time-of-day greeting and the unread notifications count |
| Quick access | — | Enabled modules as tiles (choose which) |
| Notifications | — | Latest notifications, unread marks, *Read all* |
| Recent files | Files | Latest files and used space |
| Knowledge base | Knowledge base | Recently updated documents |
| Users and sign-ins | `users.view` | Accounts, active in 30 days, new, sign-ins and failed sign-ins per day |
| World clock | — | Local time (digital or analog) and up to 6 cities with the difference |
| Note | — | A sticky note, saved as you type |

Every widget reads through the owning module with the person's own rights, so it never shows more than the module would. Data refreshes every few minutes and when the tab comes back; day boundaries follow the browser's time zone.

## For administrators

Settings → **Dashboard**: on/off, page title, *Personal dashboards* (off: everyone sees the starting layout and cannot change it).

Permission `dashboard.admin` (super administrators always): on the dashboard, **Customize → Administration → Make it the starting layout** saves the current arrangement as the starting set for everyone without their own; *Back to the built-in starting layout* undoes it.

## Technical notes

- Tables: `dash_layouts` (per person: widgets with type, size, settings, in order) and `dash_default` (one row, the administrator's starting layout). Without either the built-in layout in `modules/dashboard/widgets.js` is used.
- Widgets of modules switched off are kept in a saved layout and come back with the module.
- An API token reads a widget only with the scope of its module (`notifications` for notifications, `admin.users` for people); the welcome widget leaves out the parts the token may not read.
- API (`/api/app/dashboard`): `GET /` (layout, available widgets, rights), `PUT /layout`, `DELETE /layout`, `PUT|DELETE /default` (`dashboard.admin`), `GET /options` (choices for widget settings; empty for the shipped widgets), `GET /data/:type?settings=<json>&tz=<zone>` (widget data).
- Charts are small SVG components (`modules/dashboard/charts.jsx`); no chart library.
- Adding a widget: an entry in `WIDGETS` (backend, with its module and permission), a provider in `data.js` if it needs data, and an entry in the frontend `catalog.js` with the component, sizes, preview and settings fields. A new module (say `orders`) adds its widgets the same way with `module: 'orders'`, so they disappear when the module is off.
