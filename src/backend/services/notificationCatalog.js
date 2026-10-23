/*
 * Every kind of notification the portal sends, grouped for the preferences
 * screen, with the channels it uses unless the person says otherwise.
 *
 *   urgent     reminders the person scheduled themselves: they ignore quiet
 *              hours and the pause, and cannot be switched off per event
 *              (the reminder itself chooses its channels)
 *   channels   the external channels the event can use at all
 *              (a chat message is a push, never an e-mail)
 *
 * A module that sends a new kind adds it here; unknown kinds behave like
 * "on everywhere".
 */

const ALL = ['push', 'email', 'telegram', 'whatsapp', 'mattermost'];
// Messengers (Telegram, WhatsApp, Mattermost) share one default per event.
const on = (push, email, messenger) => ({ push, email, telegram: messenger, whatsapp: messenger, mattermost: messenger });

export const NOTIFICATION_GROUPS = [
  {
    key: 'files',
    module: 'files',
    events: [
      { kind: 'files.shared', defaults: on(true, true, false) },
      // Visitors uploaded or changed files through a public link with "notify me" (one notice per visit).
      { kind: 'files.linkActivity', defaults: on(true, true, false) },
    ],
  },
  {
    key: 'system',
    module: null,
    events: [{ kind: 'system.test', defaults: on(true, true, true), urgent: true, hidden: true }],
  },
];

export const NOTIFICATION_EVENTS = NOTIFICATION_GROUPS.flatMap((group) => group.events.map((event) => ({ ...event, group: group.key, module: group.module, channels: event.channels || ALL })));

export function eventInfo(kind) {
  return NOTIFICATION_EVENTS.find((event) => event.kind === kind) || { kind, defaults: on(true, true, true), channels: ALL, urgent: false };
}
