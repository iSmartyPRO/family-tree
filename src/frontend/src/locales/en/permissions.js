export default {
  groups: {
    console: 'Console',
    people: 'People & access',
    audit: 'Audit',
    settings: 'Settings',
    module_kb: 'Knowledge base',
    module_family: 'Family tree',
    module_files: 'Files',
    module_dashboard: 'Dashboard',
    api: 'API',
  },
  console_access: {
    title: 'Open the admin console',
    desc: 'Required for any work in /admin.',
  },
  users_view: {
    title: 'View users',
    desc: 'See accounts, groups and roles.',
  },
  users_manage: {
    title: 'Manage users',
    desc: 'Create accounts, edit profiles, reset passwords, block, assign groups and roles they hold.',
  },
  users_delete: {
    title: 'Delete users',
    desc: 'Permanently remove accounts.',
  },
  groups_manage: {
    title: 'Manage groups',
    desc: 'Create groups, set their roles and members.',
  },
  roles_manage: {
    title: 'Manage roles',
    desc: 'Create roles and change which permissions they grant.',
  },
  activity_view: {
    title: 'View activity',
    desc: 'Security events and sign-in history.',
  },
  settings_view: {
    title: 'View settings',
    desc: 'Read every settings screen without changing it.',
  },
  settings_general: {
    title: 'Branding & appearance',
    desc: 'Name, logos, theme, typography, icons.',
  },
  settings_security: {
    title: 'Security policy',
    desc: 'Site access, lockouts, sessions, IP filtering.',
  },
  settings_auth: {
    title: 'Sign-in methods',
    desc: 'Password, Active Directory, Telegram, one-time codes.',
  },
  settings_integrations: {
    title: 'Integrations',
    desc: 'Email, Telegram, WhatsApp, Wazzup, Active Directory.',
  },
  settings_system: {
    title: 'System',
    desc: 'API rate limits and runtime information.',
  },
  settings_modules: {
    title: 'Modules',
    desc: 'Switch modules on or off and change their system settings.',
  },
  kb_admin: {
    title: 'Knowledge base admin',
    desc: 'Full access to every folder and material, regardless of folder access.',
  },
  files_admin: {
    title: 'Files admin',
    desc: 'Manage every shared space and its access. Personal files stay private.',
  },
  dashboard_admin: {
    title: 'Dashboard admin',
    desc: 'Set the starting dashboard everyone gets until they arrange their own.',
  },
  api_tokens: {
    title: 'Personal API tokens',
    desc: 'Create tokens that act with your own rights, narrowed by scopes.',
  },
  api_admin: {
    title: 'API administration',
    desc: 'Tokens of anyone, access templates, webhooks, request log and API settings.',
  },
  ad_view: {
    title: 'AD directory: view',
    desc: 'Browse OUs, users, groups and computers within the managed root, the journal.',
  },
  ad_manage: {
    title: 'AD directory: manage accounts',
    desc: 'Create users, edit attributes, move, enable / disable, unlock, group membership (not folder access groups). Runs with the administrator’s own AD account.',
  },
  ad_passwords: {
    title: 'AD directory: reset passwords',
    desc: 'Reset passwords (with «must change at next logon») and unlock accounts. Needs LDAPS or StartTLS.',
  },
  ad_admin: {
    title: 'AD directory: administrator',
    desc: 'Everything in the module, including protected (administrative) accounts.',
  },
  family_admin: {
    title: 'Family tree admin',
    desc: 'Full access to every family tree, regardless of its access list.',
  },
};
