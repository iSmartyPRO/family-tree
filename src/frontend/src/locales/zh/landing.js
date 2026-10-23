// 单页首页的文本（pages/Home.jsx）。新项目请在此处替换。
export default {
  navLabel: '页面章节',
  nav: {
    features: '功能',
    how: '使用流程',
    faq: '常见问题',
    contact: '联系',
  },
  kicker: '新项目',
  title: '一句话介绍产品：为谁解决什么问题。',
  subtitle: '在这里用一两句话说明核心价值。上方的名称和描述取自“设置 → 常规”。',
  ctaLogin: '登录',
  ctaAccount: '打开个人中心',
  ctaAdmin: '管理',
  ctaMore: '了解更多',
  facts: [
    { value: '24/7', label: '通过浏览器和手机访问' },
    { value: '5', label: '种界面语言' },
    { value: 'SSO', label: '通过 AD、Google、Telegram 登录' },
  ],
  features: {
    kicker: '功能',
    title: '产品能做什么',
    lead: '描述三到六项核心功能。图标来自菜单图标集（components/icons）。',
    items: [
      { icon: 'shield', title: '安全登录', text: '密码、通过邮件/Telegram/WhatsApp 发送的验证码、Active Directory 和 Google — 在设置中开启。' },
      { icon: 'people', title: '角色与权限', text: '用户、组和角色，每个模块都有精确的权限。' },
      { icon: 'integrations', title: '集成', text: '邮件、即时通讯、Google 以及带 Webhook 的 API 令牌，便于对接其他系统。' },
      { icon: 'file', title: '知识库与文件', text: '文章、指南和文档，按角色控制访问并支持公开链接。' },
      { icon: 'palette', title: '您的风格', text: '配色模板、字体、徽标和深色主题 — 无需改代码。' },
      { icon: 'globe', title: '开箱即用', text: 'Docker、PostgreSQL、首次运行向导，以及可安装到手机的 PWA。' },
    ],
  },
  how: {
    kicker: '使用流程',
    title: '三步获得成果',
    lead: '描述用户的路径：从首次登录到从产品中获益。',
    steps: [
      { title: '注册', text: '管理员邀请成员，或开启企业账户登录。' },
      { title: '配置', text: '选择适合您流程的模块、权限和集成。' },
      { title: '使用', text: '团队在浏览器或手机应用中使用产品。' },
    ],
  },
  faq: {
    kicker: '常见问题',
    title: '常见问题',
    lead: '开始之前大家常问的问题。',
    items: [
      { q: '数据存储在哪里？', a: '在您的服务器上：应用和 PostgreSQL 以 Docker 方式运行在您自己的基础设施中。' },
      { q: '可以对外部访客关闭网站吗？', a: '可以。在“封闭”模式下访客只能看到登录表单；在“开放”模式下可看到本页面。' },
      { q: '如何接入企业登录？', a: '在“设置 → 登录方式”中开启 Active Directory、Google 或验证码登录。' },
      { q: '有移动应用吗？', a: '门户可以作为应用（PWA）安装到手机上，并发送推送通知。' },
    ],
  },
  contact: {
    title: '准备好开始了吗？',
    text: '登录系统或给我们写信 — 我们会帮助您完成接入。',
    cta: '登录',
    email: 'hello@example.com',
  },
};
