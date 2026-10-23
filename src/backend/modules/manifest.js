/**
 * Module manifests (spec docs/specs/platform-2.0.ru.md §1.2, §1.4).
 *
 * One plain object per module, keyed by id, with the facts the platform needs
 * to reason about modules: version, category, hard requirements, optional
 * links, the minimum core version and a short changelog. Settings defaults,
 * sanitizers and permissions stay in catalog.js (merged in by moduleManifest()).
 * No imports, so anything (settings, permissions, tests, the System page) can
 * read it without loading module code.
 *
 * The client gets the same objects from GET /api/admin/modules and adds its
 * own UI parts (icon, settings screen, admin docs, tour) from
 * src/frontend/src/modules/manifest.js.
 *
 * Shape (docs/extending.md «Module manifest»):
 *
 *   tasks: {
 *     name:        { en, ru },                  // fallback name (the UI uses i18n apps.<id>.name)
 *     version:     '1.0.0',                     // semver of the module, independent of the core VERSION
 *     category:    'work',                      // one of CATEGORIES
 *     minCore:     '1.4.0',                     // lowest core VERSION this module runs on
 *     requires:    [{ id: 'approvals', reason: { en, ru } }        // another module: must be on
 *                   { integration: 'activeDirectory', reason }],    // an integration: must be on (Settings → Integrations);
 *                                                                   //   `demo: true` — may be switched on without it (setup page / demo data)
 *     enhances:    [{ id: 'calendar', what: { en, ru } }],          // optional link: works without it, the feature hides
 *     docs:        { user: 'tasks', guide: 'docs/tasks.md' },       // help article id (/help/<user>) and the developer doc
 *     changelog:   [{ version: '1.0.0', date: '2026-10-16', changes: { en: [...], ru: [...], ky: [...], … } }],  // newest first, a few entries
 *   }
 *
 * Version bump rules: patch for fixes, minor for new features and new
 * settings with defaults, major for changes that need an administrator's
 * attention (removed settings, a data migration that cannot be undone, an API
 * change). Add a changelog entry with every bump; keep the last 5.
 */

/** Categories of the «Modules» page, in display order (labels: i18n platform.categories.<id>). */
export const CATEGORIES = ['work', 'documents', 'sales', 'supply', 'people', 'infrastructure'];

/** Integrations a manifest may name in `requires` / `enhances` (keys of settings.integrations). */
export const INTEGRATIONS = ['email', 'telegram', 'whatsapp', 'wazzup', 'mattermost', 'google', 'documents', 'activeDirectory'];

const FIRST = '2026-10-16';
const first = (en, ru, more = {}) => [{ version: '1.0.0', date: FIRST, changes: { en, ru, ...more } }];

export const MODULE_MANIFEST = {
  dashboard: {
    name: { en: 'Dashboard', ky: 'Башкаруу панели', tr: 'Pano', zh: '仪表板', ru: 'Дашборд' },
    version: '1.0.0',
    category: 'work',
    minCore: '1.4.0',
    requires: [],
    enhances: [
      { id: 'files', what: { en: 'Recent files and storage usage', ky: 'Акыркы файлдар жана ээленген орун', tr: 'Son dosyalar ve depolama kullanımı', zh: '最近的文件和存储用量', ru: 'Недавние файлы и занятое место' } },
      { id: 'kb', what: { en: 'New knowledge base materials', ky: 'Билим базасынын жаңы материалдары', tr: 'Yeni bilgi bankası içerikleri', zh: '知识库新内容', ru: 'Новые материалы базы знаний' } },
    ],
    docs: { user: 'dashboard', guide: 'docs/dashboard.md' },
    changelog: first(['Widgets from every enabled module, personal layouts, charts.'], ['Виджеты всех включённых модулей, личная раскладка, графики.'], { ky: ['Бардык күйгүзүлгөн модулдардын виджеттери, жеке жайгашуу, диаграммалар.'], tr: ['Etkin her modülden pencere öğeleri, kişisel düzenler, grafikler.'], zh: ['来自所有已启用模块的小组件、个人布局、图表。'] }),
  },
  assistant: {
    name: { en: 'Robot assistant', ky: 'Робот-жардамчы', tr: 'Robot asistan', zh: '机器人助手', ru: 'Робот-помощник' },
    version: '1.0.0',
    category: 'work',
    minCore: '1.4.0',
    requires: [],
    enhances: [],
    docs: { user: 'assistant', guide: 'docs/assistant.md' },
    changelog: first(['Characters, tips on first visit, quick help.'], ['Персонажи, подсказки при первом входе, быстрая справка.'], { ky: ['Каармандар, биринчи киргенде кеңештер, ыкчам жардам.'], tr: ['Karakterler, ilk ziyarette ipuçları, hızlı yardım.'], zh: ['角色形象、首次访问提示、快速帮助。'] }),
  },
  files: {
    name: { en: 'Files', ky: 'Файлдар', tr: 'Dosyalar', zh: '文件', ru: 'Файлы' },
    version: '1.0.0',
    category: 'documents',
    minCore: '1.4.0',
    requires: [],
    enhances: [{ integration: 'documents', what: { en: 'Office previews and online editing', ky: 'Office документтерин көрүү жана онлайн түзөтүү', tr: 'Office önizlemeleri ve çevrimiçi düzenleme', zh: 'Office 文档预览和在线编辑', ru: 'Просмотр и онлайн-редактирование документов Office' } }],
    docs: { user: 'files', guide: 'docs/files.md' },
    changelog: first(['Personal and shared spaces, public links, quotas, trash.'], ['Личные и общие пространства, публичные ссылки, квоты, корзина.'], { ky: ['Жеке жана жалпы мейкиндиктер, ачык шилтемелер, квоталар, себет.'], tr: ['Kişisel ve paylaşılan alanlar, herkese açık bağlantılar, kotalar, çöp kutusu.'], zh: ['个人和共享空间、公开链接、配额、回收站。'] }),
  },
  kb: {
    name: { en: 'Knowledge base', ky: 'Билим базасы', tr: 'Bilgi bankası', zh: '知识库', ru: 'База знаний' },
    version: '1.0.0',
    category: 'documents',
    minCore: '1.4.0',
    requires: [],
    enhances: [
      { id: 'files', what: { en: 'Pick materials from Files', ky: '«Файлдар» бөлүмүнөн материалдарды тандоо', tr: 'Dosyalar\'dan içerik seçme', zh: '从“文件”选择内容', ru: 'Выбор материалов из «Файлов»' } },
      { integration: 'documents', what: { en: 'Exact previews of Word and PowerPoint', ky: 'Word жана PowerPoint\'ту так көрүү', tr: 'Word ve PowerPoint için birebir önizleme', zh: 'Word 和 PowerPoint 精确预览', ru: 'Точный просмотр Word и PowerPoint' } },
    ],
    docs: { user: 'kb', guide: 'docs/knowledge-base.md' },
    changelog: first(['Folders, articles and files with access rules and public links.'], ['Папки, статьи и файлы с правами доступа и публичными ссылками.'], { ky: ['Кирүү укуктары жана ачык шилтемелери бар папкалар, макалалар жана файлдар.'], tr: ['Erişim kuralları ve herkese açık bağlantılarla klasörler, makaleler ve dosyalar.'], zh: ['带访问规则和公开链接的文件夹、文章和文件。'] }),
  },
  family: {
    name: { en: 'Family tree', ky: 'Санжыра', tr: 'Soy ağacı', zh: '家谱', ru: 'Семейное древо' },
    version: '1.0.0',
    category: 'people',
    minCore: '1.4.0',
    requires: [],
    enhances: [],
    docs: { user: 'family', guide: 'docs/family.md' },
    changelog: first(
      ['Family trees with automatic layout: couples, children and generations drawn from the links; photos, sharing and public links.'],
      ['Семейные деревья с автоматической раскладкой: пары, дети и поколения строятся по связям; фото, совместный доступ и публичные ссылки.'],
      {
        ky: ['Автоматтык жайгаштырылган санжыралар: жубайлар, балдар жана муундар байланыштардан курулат; сүрөттөр, бөлүшүү жана ачык шилтемелер.'],
        tr: ['Otomatik yerleşimli soy ağaçları: çiftler, çocuklar ve kuşaklar bağlardan çizilir; fotoğraflar, paylaşım ve herkese açık bağlantılar.'],
        zh: ['自动布局的家谱：根据关系绘制夫妻、子女和世代；照片、共享和公开链接。'],
      }
    ),
  },
};

/**
 * Core services: always on, listed in the «Core» section of the Modules page
 * (labels: i18n platform.core.<id>). `path` is where an administrator sets them up.
 */
export const CORE_SERVICES = [
  { id: 'users', icon: 'people', path: '/admin/users' },
  { id: 'signin', icon: 'shield', path: '/admin/settings/signin' },
  { id: 'notifications', icon: 'bell', path: '/admin/settings/notifications' },
  { id: 'api', icon: 'code', path: '/admin/api' },
  { id: 'activity', icon: 'bell', path: '/admin/activity' },
  { id: 'regional', icon: 'globe', path: '/admin/settings/general' },
  { id: 'appearance', icon: 'palette', path: '/admin/settings/theme' },
  { id: 'scheduler', icon: 'server', path: '/admin/settings/system' },
  { id: 'help', icon: 'graduation', path: '/help' },
];

// ── Versions ────────────────────────────────────────────────────────────────

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export function isSemver(value) {
  return typeof value === 'string' && SEMVER.test(value);
}

/** -1 / 0 / 1; prerelease and build suffixes are ignored. */
export function compareVersions(a, b) {
  const pa = SEMVER.exec(String(a)) || [0, 0, 0, 0];
  const pb = SEMVER.exec(String(b)) || [0, 0, 0, 0];
  for (let i = 1; i <= 3; i += 1) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// ── Validation ──────────────────────────────────────────────────────────────

const text = (value) => value && typeof value === 'object' && typeof value.en === 'string' && typeof value.ru === 'string';

/**
 * Problems of a manifest set, as readable strings (empty = valid): unknown
 * ids, bad versions or categories, missing texts, requirement cycles.
 * `catalogIds`: ids of MODULE_CATALOG; each must have a manifest and back.
 */
export function validateManifests(manifest = MODULE_MANIFEST, { catalogIds, coreVersion, coreIds = [] } = {}) {
  const problems = [];
  const ids = new Set(Object.keys(manifest));
  if (catalogIds) {
    for (const id of catalogIds) if (!ids.has(id)) problems.push(`${id}: no manifest entry`);
    for (const id of ids) if (!catalogIds.includes(id)) problems.push(`${id}: manifest entry without a catalog module`);
  }
  for (const [id, entry] of Object.entries(manifest)) {
    if (!isSemver(entry.version)) problems.push(`${id}: version "${entry.version}" is not semver`);
    if (!isSemver(entry.minCore)) problems.push(`${id}: minCore "${entry.minCore}" is not semver`);
    else if (coreVersion && compareVersions(coreVersion, entry.minCore) < 0) problems.push(`${id}: needs core ${entry.minCore}, running ${coreVersion}`);
    if (!CATEGORIES.includes(entry.category)) problems.push(`${id}: unknown category "${entry.category}"`);
    if (!text(entry.name)) problems.push(`${id}: name needs en and ru`);
    for (const [field, label] of [['requires', 'reason'], ['enhances', 'what']]) {
      if (!Array.isArray(entry[field])) {
        problems.push(`${id}: ${field} must be a list`);
        continue;
      }
      for (const link of entry[field]) {
        if (link.integration) {
          if (!INTEGRATIONS.includes(link.integration)) problems.push(`${id}: ${field} names unknown integration "${link.integration}"`);
        } else if (!ids.has(link.id)) problems.push(`${id}: ${field} names unknown module "${link.id}"`);
        else if (link.id === id) problems.push(`${id}: ${field} names itself`);
        if (!text(link[label])) problems.push(`${id}: ${field} → ${link.id || link.integration} needs ${label} in en and ru`);
      }
    }
    if (!Array.isArray(entry.changelog) || !entry.changelog.length) problems.push(`${id}: changelog is empty`);
    else if (entry.changelog[0].version !== entry.version) problems.push(`${id}: the newest changelog entry is not ${entry.version}`);
  }
  const cycle = findRequiresCycle(manifest);
  if (cycle) problems.push(`requirement cycle: ${cycle.join(' → ')}`);
  // A core module (always on) may not require one that can be switched off.
  for (const id of coreIds) {
    for (const link of manifest[id]?.requires || []) {
      if (link.id && !coreIds.includes(link.id)) problems.push(`${id}: a core module cannot require the optional module "${link.id}"`);
    }
  }
  return problems;
}

/** The first cycle in the `requires` graph (module ids only) as [a, b, …, a], or null. */
export function findRequiresCycle(manifest = MODULE_MANIFEST) {
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 'open');
    stack.push(id);
    for (const link of manifest[id]?.requires || []) {
      if (!link.id || !manifest[link.id]) continue;
      if (state.get(link.id) === 'open') return [...stack.slice(stack.indexOf(link.id)), link.id];
      if (!state.has(link.id)) {
        const found = visit(link.id);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };
  for (const id of Object.keys(manifest)) {
    if (!state.has(id)) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}

/** Module ids so that every module comes after the modules it requires (stable: `order` breaks ties). */
export function dependencyOrder(ids, manifest = MODULE_MANIFEST, order = ids) {
  const wanted = new Set(ids);
  const done = new Set();
  const out = [];
  const place = (id, seen = new Set()) => {
    if (done.has(id) || seen.has(id)) return;
    seen.add(id);
    for (const link of manifest[id]?.requires || []) if (link.id && wanted.has(link.id)) place(link.id, seen);
    done.add(id);
    out.push(id);
  };
  for (const id of [...order].filter((id) => wanted.has(id))) place(id);
  for (const id of ids) place(id);
  return out;
}
