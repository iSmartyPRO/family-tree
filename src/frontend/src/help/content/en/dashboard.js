export default {
  id: 'dashboard',
  icon: 'dashboard',
  title: 'Dashboard',
  tagline: 'Your day at a glance: notifications, files and new materials on one page.',
  summary: 'The dashboard gathers what matters from the portal’s other modules as widgets. Add them from the gallery, arrange and resize them, set their filters — everything saves automatically.',
  highlights: [
    {
      icon: '🧩',
      title: 'Widgets for everything',
      text: 'Greeting, notifications, recent files, knowledge base, a clock, a note and more.',
    },
    {
      icon: '📊',
      title: 'Figures for administrators',
      text: 'Accounts, activity and sign-ins by day — at a glance, for the period you choose.',
    },
    {
      icon: '🖱',
      title: 'Drag and resize',
      text: 'Drag a widget by its header, resize it by the bottom-right corner.',
    },
    {
      icon: '⚙',
      title: 'Your own settings',
      text: 'Each widget has its own title and settings: how many items, period, cities, colour.',
    },
    {
      icon: '🔒',
      title: 'Only what you may see',
      text: 'Widgets show data with your own rights — never more than the module itself.',
    },
    {
      icon: '💾',
      title: 'Saves itself',
      text: 'Changes save automatically and appear on all your devices.',
    },
  ],
  tips: [
    'Add the same widget several times — e.g. two “World clock” cards for different offices.',
    'Give each copy its own title so you don’t mix them up: “Clock · Asia”, “Clock · Europe”.',
    'Removed a widget by accident? Click “Undo” in the pop-up — you have 5 seconds.',
    'The widget’s ⋯ menu has ready sizes: small, medium, large, wide, full width.',
    'Got lost? “Customize” → “Reset” brings back the starting set.',
  ],
  sections: [
    {
      id: 'widgets',
      title: 'Widgets and their data',
      body: `A widget is a card with data from one of the portal’s modules:

- **Greeting** — the date, a greeting and how many notifications are unread;
- **Quick access** — portal modules as large tiles or a list;
- **Notifications** — the latest notifications with “read all”;
- **Recent files** — your latest files and how much space you use;
- **Knowledge base** — recently updated documents and articles;
- **Users and sign-ins** — accounts, activity and sign-ins by day (for those allowed to view users);
- **World clock** and **Note**.

Data refreshes every few minutes and when you return to the tab. Widgets show only what you can see in the module itself.`,
      note: 'If a module is off or not available to you, its widgets are not shown. When the module is back on, they return to their places.',
    },
    {
      id: 'gallery',
      title: 'Adding a widget from the gallery',
      body: `The gallery lists all widgets available to you by category: **Overview**, **Files and knowledge**, **Administration** and **Tools**. Each has a preview and a short description; there is a search.

A new widget appears at the top of the dashboard and is briefly highlighted.`,
      steps: [
        'Click **“Add widget”** at the top of the page.',
        'Pick a category on the left or type a name in the search.',
        'Click the widget card — it is added to the dashboard.',
        'Open ⚙ on the widget to tailor it.',
      ],
      example: {
        title: 'Clocks for two offices side by side',
        body: 'A manager works with offices in Asia and Europe. She adds “World clock” twice. In the first one’s ⚙ she picks Asian cities and titles it “Asia”; in the second, European cities and “Europe”. Now both clocks sit side by side.',
      },
    },
    {
      id: 'arrange',
      title: 'Moving and resizing',
      body: `In **“Customize”** mode:

- **move** — drag a widget by its header;
- **resize** — drag the bottom-right corner; the size snaps to the grid and is shown while dragging;
- **preset sizes** — ⋯ menu → “Size”: small, medium, large, wide, full width.

Wide screens have a 12-column grid, tablets 6. Gaps close by themselves. Click **“Done”** to leave customize mode.`,
      note: 'The status above the dashboard shows “Saving…”, “Saved ✓”. No need to press Save.',
    },
    {
      id: 'settings',
      title: 'Widget settings and filters',
      body: `The **⚙** button opens a widget’s settings. Every widget has a **Title** — your own name for the card. The rest depends on the widget:

- **Greeting** — whether to show the unread counter;
- **Quick access** — which modules, tiles or list;
- **Notifications** — unread only, how many to show;
- **Recent files** — show used space, how many to show;
- **Knowledge base** — how many to show;
- **Users and sign-ins** — period (7, 14, 30, 90 days);
- **World clock** — other cities (up to 6), 24/12 h, analog clock;
- **Note** — colour.

Click **“Save”** in the settings window — the widget updates right away.`,
      example: {
        title: 'Only what is unread',
        body: 'To keep an eye only on what you haven’t read yet, open ⚙ in “Notifications”, turn on **Unread only**, set **How many to show** to 10 and title the widget “To read”.',
      },
    },
    {
      id: 'manage',
      title: 'Duplicate, remove, undo',
      body: `The **⋯** menu on a widget in customize mode:

- **Duplicate** — a copy with the same settings appears next to it; handy for a similar widget with another filter;
- **Open module** — go to the module the data comes from;
- **Remove** — the widget disappears and an **“Undo”** button shows for 5 seconds.

**“Reset”** replaces all your widgets, sizes and settings with the starting set — the portal asks first.`,
      note: 'A reset cannot be undone. If unsure, remove widgets one by one instead.',
    },
    {
      id: 'default',
      title: 'Starting set from the administrator',
      body: `Until you change anything, you see the **starting set**: greeting, quick access, notifications, knowledge base, recent files, world clock and, for administrators, users and sign-ins. Widgets of modules you can’t use are hidden.

A dashboard administrator can make their dashboard the starting one for everyone without their own: **“Customize” → “Administration” → “Make it the starting layout”**. **“Back to the built-in starting layout”** undoes it.

If **“Personal dashboards”** is off in **Settings → Modules → Dashboard**, everyone sees the starting set and cannot change it.`,
      steps: [
        'Arrange the dashboard as everyone should see it.',
        'Click **“Customize”** → **“Administration”**.',
        'Choose **“Make it the starting layout”** and confirm.',
      ],
      example: {
        title: 'A dashboard for newcomers',
        body: 'The administrator puts “Greeting”, “Quick access” and “Knowledge base” on top, “Notifications” and “Recent files” below, and makes it the starting set. Every new employee sees the right modules and guides from day one.',
      },
      note: 'People who already have their own dashboard are not affected — until they click “Reset”.',
    },
    {
      id: 'mobile',
      title: 'On a phone',
      body: `On a narrow screen widgets line up **in one column**, in the same order as on the computer. Width can’t be changed on a phone — arranging is easier on a large screen.

You have one dashboard on all devices: what you change on the computer is on your phone too.`,
    },
  ],
  faq: [
    {
      q: 'There is no “Customize” button.',
      a: 'The administrator has turned off **personal dashboards** — everyone has the same starting set.',
    },
    {
      q: 'Why is a widget missing from the gallery?',
      a: 'Its module is off or you have no access to it. For example, “Users and sign-ins” is only for people allowed to view users.',
    },
    {
      q: 'Do colleagues see my dashboard?',
      a: 'No, the dashboard is personal. And each person’s widgets show data according to their own rights.',
    },
    {
      q: 'How do I start over?',
      a: '**“Customize” → “Reset”** brings back the starting set. Your widgets and settings will be lost.',
    },
    {
      q: 'Is the text in a “Note” saved?',
      a: 'Yes, the note saves as you type. Only you see it.',
    },
    {
      q: 'Can the dashboard open at the portal’s address?',
      a: 'Yes, if the administrator picks “Dashboard” in **Settings → Site access → Home page**.',
    },
  ],
  fields: {
    widgetTitle: {
      title: 'Title',
      text: 'Your own name for the card. Empty — the widget’s standard name. Handy when you have several of the same.',
      more: 'settings',
    },
    period: {
      title: 'Period',
      text: 'How many recent days the figures and chart cover.',
      more: 'settings',
    },
    gallery: {
      title: 'Widget gallery',
      text: 'Only widgets available to you are listed. The same one can be added several times with different settings.',
      more: 'gallery',
    },
    personalize: {
      title: 'Personal dashboards',
      text: 'On — everyone builds their own dashboard. Off — everyone sees the starting set and cannot change it.',
      more: 'default',
    },
  },
  related: [
    'files',
    'kb',
    'start',
  ],
};
