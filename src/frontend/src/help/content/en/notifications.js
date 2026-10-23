export default {
  id: 'notifications',
  icon: 'bell',
  title: 'Notifications',
  tagline: 'What the portal tells you, where and when',
  summary: 'The portal tells you when files and folders are shared with you and when someone uses your public links. Everything always lands in the bell, and you decide what else goes to push, e-mail, Telegram, WhatsApp and Mattermost: per event, with quiet hours and a pause.',
  highlights: [
    {
      icon: '🔔',
      title: 'The bell',
      text: 'Every notification in one place in the header, with an unread counter.',
    },
    {
      icon: '📱',
      title: 'Push and messengers',
      text: 'Push to phone and computer, e-mail, Telegram, WhatsApp and Mattermost — whichever are connected.',
    },
    {
      icon: '🎚️',
      title: 'Per event',
      text: 'An “event × channel” table: e.g. shared files everywhere, link activity push only.',
    },
    {
      icon: '🌙',
      title: 'Quiet hours and pause',
      text: 'No pushes or messages at night or at weekends; pause for an hour or until morning.',
    },
    {
      icon: '🧪',
      title: 'Test and history',
      text: 'A test through every channel and a history: where each one went and why it did not arrive.',
    },
  ],
  tips: [
    'Start with “Send a test” — you see at once which channels work.',
    'Push on a phone works best when the portal is installed as an app.',
    'Too many messages? “Presets” → “Only important”.',
  ],
  sections: [
    {
      id: 'channels',
      title: 'Channels: where notifications go',
      body: `- **The bell** in the header — always, nothing is lost.
- **Push** — pop-up notifications on phone and computer. Turned on per device in [notification settings](/account/notifications) (“Push on this device”). On iPhone push works only in the installed app (Share → “Add to Home Screen”).
- **E-mail** — to the address in your [profile](/account).
- **Telegram** — link your account in [Profile → Security](/account/security).
- **WhatsApp** — add your mobile phone in the [profile](/account); messages go to that number (if the administrator has connected WhatsApp).
- **Mattermost** — enter your Mattermost name in your [profile](/account).

A channel card shows its state: “On”, “Off” (by you) or “Not connected” — with a link to connect it. A switched-off channel gets nothing.`,
      steps: [
        'Open [Profile → Notifications](/account/notifications).',
        'Connect the channels you want using the links in the cards.',
        'Click **Send a test** — each channel shows “delivered” or the reason it failed.',
      ],
    },
    {
      id: 'events',
      title: 'What to tell you about',
      body: `In the “About what” table rows are events (a file or folder was shared with you, someone uploaded through your public link…), columns are channels. Tick where you want each event. Grey columns are channels that are not connected or switched off.

The **“Bell”** column is the portal bell. Untick it if you do not need an event at all.

**Presets** change the whole table at once: “Recommended”, “Only important”, “Everything everywhere”, “Bell only”.`,
      example: {
        title: 'Fewer e-mails, nothing important missed',
        body: 'Choose “Presets” → “Only important”: the important events go to e-mail and Telegram, the rest only to the bell. Then tick push for “Uploads and changes through your public links” if you want to see when a client sends files.',
      },
    },
    {
      id: 'quiet',
      title: 'Quiet hours and pause',
      body: `**Quiet hours** — e.g. 22:00 to 08:00 and all weekend — keep push, e-mail and messengers silent. **Pause** does the same for a while: an hour, 3 hours, until tomorrow morning or until Monday.

The bell keeps collecting everything, so in the morning you see what happened.

Quiet hours and the pause follow your time zone — change it in [Appearance → Date and time](/account/appearance).`,
      note: 'Quiet hours use your browser’s time zone — it is saved when you change the settings.',
    },
    {
      id: 'history',
      title: 'Delivery history',
      body: 'At the bottom of notification settings are the recent notifications with a mark per channel: green — delivered, grey — not used (off, not connected, quiet hours), red — failed. Hover a mark to read the reason.',
    },
  ],
  faq: [
    {
      q: 'Nothing arrives in Telegram',
      a: 'Link Telegram in [Profile → Security](/account/security), then in [notifications](/account/notifications) switch the Telegram card on and click “Send a test”. If the card says “Unavailable”, the administrator has not set up the bot yet.',
    },
    {
      q: 'No push on my phone',
      a: 'Open notification settings on the phone itself and turn on “Push on this device”. On iPhone first add the portal to the Home Screen and open it from there. Check that notifications for the browser/app are allowed in the phone’s settings.',
    },
    {
      q: 'How do I get fewer notifications?',
      a: '“Presets” → “Only important”, turn on quiet hours, and untick specific events in the table.',
    },
    {
      q: 'Are notifications lost during quiet hours?',
      a: 'No. They are always in the bell; quiet hours only hold back push, e-mail and messengers.',
    },
    {
      q: 'Where can I see why a notification did not arrive?',
      a: 'In notification settings → “Recent notifications”: hover a channel mark.',
    },
  ],
  fields: {
    channels: {
      title: 'Channels',
      text: 'Where notifications go besides the bell. “Send a test” checks every connected channel.',
      more: 'channels',
    },
    quiet: {
      title: 'Quiet hours and pause',
      text: 'Push, e-mail and messengers stay silent then; the bell collects everything.',
      more: 'quiet',
    },
    events: {
      title: 'Events and channels',
      text: 'Tick where each event goes. “Presets” change everything at once.',
      more: 'events',
    },
    subscriptions: {
      title: 'Subscriptions',
      text: 'What you follow without taking part in each item. Unsubscribe here at any time.',
      more: 'events',
    },
  },
  related: [
    'account',
    'files',
    'start',
  ],
};
