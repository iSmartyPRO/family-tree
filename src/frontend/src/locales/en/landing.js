// Texts of the one-page landing (pages/Home.jsx). Replace them here for a new project.
export default {
  navLabel: 'Page sections',
  nav: {
    features: 'Features',
    how: 'How it works',
    faq: 'FAQ',
    contact: 'Contact',
  },
  kicker: 'New project',
  title: 'The product in one line: the problem it solves and for whom.',
  subtitle: 'One or two sentences about the main value go here. The name and description above come from Settings → General.',
  ctaLogin: 'Sign in',
  ctaAccount: 'Open cabinet',
  ctaAdmin: 'Administration',
  ctaMore: 'Learn more',
  facts: [
    { value: '24/7', label: 'Access from a browser and a phone' },
    { value: '5', label: 'Interface languages' },
    { value: 'SSO', label: 'Sign in with AD, Google, Telegram' },
  ],
  features: {
    kicker: 'Features',
    title: 'What the product does',
    lead: 'Describe three to six key capabilities. Icons come from the menu icon set (components/icons).',
    items: [
      { icon: 'shield', title: 'Secure sign-in', text: 'Password, codes by e-mail, Telegram or WhatsApp, Active Directory and Google — switched on in the settings.' },
      { icon: 'people', title: 'Roles and permissions', text: 'Users, groups and roles with precise permissions for every section.' },
      { icon: 'integrations', title: 'Integrations', text: 'E-mail, messengers, Google and API tokens with webhooks for other systems.' },
      { icon: 'file', title: 'Knowledge base and files', text: 'Articles, guides and documents with role-based access and public links.' },
      { icon: 'palette', title: 'Your style', text: 'Color templates, fonts, logos and a dark theme — without touching the code.' },
      { icon: 'globe', title: 'Ready to run', text: 'Docker, PostgreSQL, a first-run wizard and a PWA to install on a phone.' },
    ],
  },
  how: {
    kicker: 'How it works',
    title: 'Three steps to the result',
    lead: 'Describe the user’s path: from the first sign-in to getting value from the product.',
    steps: [
      { title: 'Sign up', text: 'An administrator invites people or turns on sign-in with company accounts.' },
      { title: 'Set up', text: 'Choose the modules, permissions and integrations that fit your processes.' },
      { title: 'Work', text: 'The team uses the product in a browser or in the app on their phone.' },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Frequently asked questions',
    lead: 'Answers to what people ask before they start.',
    items: [
      { q: 'Where is the data stored?', a: 'On your server: the application and PostgreSQL run in Docker in your own infrastructure.' },
      { q: 'Can the site be closed to outsiders?', a: 'Yes. In «Closed» mode guests see only the sign-in form; in «Open» mode — this page.' },
      { q: 'How do I connect company sign-in?', a: 'Turn on Active Directory, Google or sign-in by code under Settings → Sign-in methods.' },
      { q: 'Is there a mobile app?', a: 'The portal installs on a phone as an app (PWA) and sends push notifications.' },
    ],
  },
  contact: {
    title: 'Ready to start?',
    text: 'Sign in or write to us — we will help you get connected.',
    cta: 'Sign in',
    email: 'hello@example.com',
  },
};
