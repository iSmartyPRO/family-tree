export default {
  groups: {
    console: '控制台',
    people: '人员和访问',
    audit: '审计',
    settings: '设置',
    module_kb: '知识库',
    module_family: '家谱',
    module_files: '文件',
    module_dashboard: '仪表板',
    api: 'API',
  },
  console_access: {
    title: '打开管理控制台',
    desc: '在 /admin 中进行任何操作都需要此权限。',
  },
  users_view: {
    title: '查看用户',
    desc: '查看账户、组和角色。',
  },
  users_manage: {
    title: '管理用户',
    desc: '创建账户、编辑个人资料、重置密码、锁定，以及在自身权限范围内分配组和角色。',
  },
  users_delete: {
    title: '删除用户',
    desc: '永久删除账户。',
  },
  groups_manage: {
    title: '管理组',
    desc: '创建组，设置其角色和成员。',
  },
  roles_manage: {
    title: '管理角色',
    desc: '创建角色并更改其授予的权限。',
  },
  activity_view: {
    title: '查看日志',
    desc: '安全事件和登录历史。',
  },
  settings_view: {
    title: '查看设置',
    desc: '查看所有设置页面，但不可更改。',
  },
  settings_general: {
    title: '品牌和外观',
    desc: '名称、标志、主题、字体、图标。',
  },
  settings_security: {
    title: '安全策略',
    desc: '网站访问、锁定、会话、IP 过滤。',
  },
  settings_auth: {
    title: '登录方式',
    desc: '密码、Active Directory、Telegram、一次性验证码。',
  },
  settings_integrations: {
    title: '集成',
    desc: '电子邮件、Telegram、WhatsApp、Wazzup、Active Directory。',
  },
  settings_system: {
    title: '系统',
    desc: 'API 速率限制和运行环境信息。',
  },
  settings_modules: {
    title: '模块',
    desc: '启用或停用模块，并更改其系统设置。',
  },
  kb_admin: {
    title: '知识库管理员',
    desc: '完全访问所有文件夹和资料，不受文件夹访问权限限制。',
  },
  files_admin: {
    title: '文件管理员',
    desc: '管理所有共享空间及其访问权限。个人文件仍保持私密。',
  },
  dashboard_admin: {
    title: '仪表板管理员',
    desc: '设置默认仪表板，所有人在自行调整前都会看到它。',
  },
  api_tokens: {
    title: '个人 API 令牌',
    desc: '创建以您自身权限运作并受权限范围限制的令牌。',
  },
  api_admin: {
    title: 'API 管理',
    desc: '任何人的令牌、访问模板、Webhook、请求日志和 API 设置。',
  },
  ad_view: {
    title: 'AD 目录：查看',
    desc: '浏览受管根节点下的 OU、用户、组和计算机，以及日志。',
  },
  ad_manage: {
    title: 'AD 目录：管理账户',
    desc: '创建用户、编辑属性、移动、启用／停用、解锁、组成员关系（文件夹访问组除外）。使用管理员自己的 AD 账户执行。',
  },
  ad_passwords: {
    title: 'AD 目录：重置密码',
    desc: '重置密码（附带「下次登录时必须更改」）并解锁账户。需要 LDAPS 或 StartTLS。',
  },
  ad_admin: {
    title: 'AD 目录：管理员',
    desc: '模块内的全部权限，包括受保护的（管理类）账户。',
  },
  family_admin: {
    title: '家谱管理员',
    desc: '无论访问列表如何，均可完全访问所有家谱。',
  },
};
