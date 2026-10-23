/*
 * Hand-written part of the API reference: sections and the endpoints worth
 * explaining. Every other route is still listed (api/introspect.js finds them
 * all), with its scope, just without prose.
 *
 * Keys are "METHOD /path" exactly as the route is declared, relative to /api.
 * Texts are L(ru, en, ky, tr, zh) — pick() falls back to English for a missing language.
 */

const L = (ru, en, ky, tr, zh) => ({ ru, en, ky, tr, zh });
const q = (name, type, desc, extra = {}) => ({ name, type, desc, ...extra });
const b = (name, type, desc, extra = {}) => ({ name, type, desc, ...extra });

export const SECTIONS = [
  { key: 'account', area: 'account', prefix: ['/auth/me', '/account'], title: L('Профиль', 'Account', 'Профиль', 'Hesap', '账户'), intro: L('Кто владелец токена и его профиль.', 'Who owns the token, and their profile.', 'Токендин ээси ким жана анын профили.', 'Belirtecin sahibi kim ve profili.', '令牌的所有者及其个人资料。') },
  { key: 'notifications', area: 'notifications', prefix: ['/notifications'], title: L('Уведомления', 'Notifications', 'Билдирмелер', 'Bildirimler', '通知'), intro: L('Входящие уведомления владельца токена: список, счётчик, отметка о прочтении.', "The token owner's inbox: list, counter, marking as read.", 'Токен ээсинин кирүүчү билдирмелери: тизме, эсептегич, окулду деп белгилөө.', 'Belirteç sahibinin gelen kutusu: liste, sayaç, okundu olarak işaretleme.', '令牌所有者的收件箱：列表、计数、标记为已读。') },
  { key: 'files', area: 'files', prefix: ['/app/files'], title: L('Файлы', 'Files', 'Файлдар', 'Dosyalar', '文件'), intro: L('Личные файлы и общие пространства: папки, загрузка, скачивание, доступ и ссылки.', 'Personal files and shared spaces: folders, upload, download, sharing and links.', 'Жеке файлдар жана жалпы мейкиндиктер: папкалар, жүктөө, жүктөп алуу, кирүү укугу жана шилтемелер.', 'Kişisel dosyalar ve paylaşılan alanlar: klasörler, yükleme, indirme, paylaşım ve bağlantılar.', '个人文件和共享空间：文件夹、上传、下载、共享和链接。') },
  { key: 'kb', area: 'kb', prefix: ['/app/kb'], title: L('База знаний', 'Knowledge base', 'Билим базасы', 'Bilgi bankası', '知识库'), intro: L('Папки и материалы базы знаний.', 'Knowledge base folders and items.', 'Билим базасынын папкалары жана материалдары.', 'Bilgi bankası klasörleri ve içerikleri.', '知识库文件夹和内容。') },
  { key: 'dashboard', area: 'dashboard', prefix: ['/app/dashboard'], title: L('Дашборд', 'Dashboard', 'Башкаруу панели', 'Pano', '仪表板'), intro: L('Виджеты владельца токена и данные для них.', "The token owner's widgets and their data.", 'Токен ээсинин виджеттери жана алар үчүн маалыматтар.', 'Belirteç sahibinin pencere öğeleri ve verileri.', '令牌所有者的小组件及其数据。') },
  { key: 'admin.users', area: 'admin.users', prefix: ['/admin/users', '/admin/groups', '/admin/roles', '/admin/permissions'], title: L('Пользователи и группы', 'Users and groups', 'Колдонуучулар жана топтор', 'Kullanıcılar ve gruplar', '用户和组'), intro: L('Учётные записи, группы и роли. Нужны права администратора у владельца токена.', 'Accounts, groups and roles. The token owner needs administrator rights.', 'Эсептик жазуулар, топтор жана ролдор. Токен ээсине администратордун укуктары керек.', 'Hesaplar, gruplar ve roller. Belirteç sahibinin yönetici haklarına sahip olması gerekir.', '账户、组和角色。令牌所有者需要管理员权限。') },
  { key: 'admin.security', area: 'admin.security', prefix: ['/admin/security'], title: L('Безопасность', 'Security', 'Коопсуздук', 'Güvenlik', '安全'), intro: L('Журнал событий безопасности и IP-правила.', 'Security events and IP rules.', 'Коопсуздук окуяларынын журналы жана IP эрежелери.', 'Güvenlik olayları ve IP kuralları.', '安全事件和 IP 规则。') },
  { key: 'admin.settings', area: 'admin.settings', prefix: ['/admin'], title: L('Администрирование', 'Administration', 'Администрлөө', 'Yönetim', '管理'), intro: L('Настройки портала, интеграции, сведения о системе.', 'Portal settings, integrations, system information.', 'Портал жөндөөлөрү, интеграциялар, система тууралуу маалымат.', 'Portal ayarları, entegrasyonlar, sistem bilgileri.', '门户设置、集成、系统信息。') },
  { key: 'common', area: null, prefix: ['/apps', '/status', '/settings'], title: L('Общее', 'General', 'Жалпы', 'Genel', '常规'), intro: L('Доступно любому действующему токену.', 'Available to any valid token.', 'Каалаган жарактуу токенге жеткиликтүү.', 'Geçerli her belirteç için kullanılabilir.', '任何有效令牌均可使用。') },
];

export const DOCS = {
  // ── Common ──
  'GET /apps': { summary: L('Включённые модули', 'Enabled modules', 'Күйгүзүлгөн модулдар', 'Etkin modüller', '已启用的模块'), response: { success: true, apps: [{ id: 'dashboard', enabled: true }, { id: 'kb', enabled: true }] } },
  'GET /status': { summary: L('Состояние API и базы данных', 'API and database status', 'API жана маалымат базасынын абалы', 'API ve veritabanı durumu', 'API 和数据库状态'), response: { success: true, api: 'ok', app: { name: 'Portal', version: '1.0.0' }, database: { connected: true } } },

  // ── Account ──
  'GET /auth/me': {
    summary: L('Владелец токена', 'Token owner', 'Токендин ээси', 'Belirteç sahibi', '令牌所有者'),
    description: L('Возвращает пользователя, от имени которого работает токен, с ролями и правами. Удобно для проверки токена.', 'Returns the person the token acts as, with roles and permissions. Handy to check a token.', 'Токен кимдин атынан иштесе, ошол адамды ролдору жана укуктары менен кайтарат. Токенди текшерүүгө ыңгайлуу.', 'Belirtecin adına çalıştığı kişiyi rolleri ve izinleriyle döndürür. Bir belirteci denetlemek için kullanışlıdır.', '返回令牌所代表的用户及其角色和权限。便于检查令牌。'),
    response: { success: true, user: { id: 7, username: 'aida', displayName: 'Aida Bekova', email: 'aida@example.com', locale: 'ru', roles: [{ key: 'user' }], permissions: ['kb.admin'] } },
  },
  'GET /account/profile': { summary: L('Профиль', 'Profile', 'Профиль', 'Profil', '个人资料'), response: { success: true, user: { id: 7, username: 'aida', displayName: 'Aida Bekova', email: 'aida@example.com', phone: '+996700000000', locale: 'ru', theme: 'light' } } },
  'PUT /account/profile': { summary: L('Изменить профиль', 'Update the profile', 'Профилди өзгөртүү', 'Profili güncelle', '更新个人资料'), body: [b('displayName', 'string', L('Имя', 'Name', 'Аты', 'Ad', '名称')), b('email', 'string', L('Почта', 'Email', 'Почта', 'E-posta', '电子邮件')), b('locale', '"ru" | "en"', L('Язык', 'Language', 'Тил', 'Dil', '语言')), b('theme', '"light" | "dark" | "system" | "graphite" | "ocean" | "forest" | "sand" | "midnight" | "lavender" | "contrast" | "dawn" | "borealis" | "constellation" | "custom"', L('Тема', 'Theme', 'Тема', 'Tema', '主题'))] },
  'GET /account/tours': { summary: L('Пройденные туры', 'Tours seen', 'Өтүлгөн турлар', 'Görülen turlar', '已看过的导览'), response: { success: true, seen: { portal: { status: 'done', version: 1, at: '2026-10-16T09:00:00.000Z' } }, disabled: false } },
  'PUT /account/tours': { summary: L('Отметить тур или выключить туры', 'Mark a tour or switch tours off', 'Турду белгилөө же турларды өчүрүү', 'Bir turu işaretle veya turları kapat', '标记导览或关闭导览'), body: [b('id', 'string', L('Тур', 'Tour', 'Тур', 'Tur', '导览')), b('status', '"done" | "skipped"', L('Пройден или пропущен', 'Done or skipped', 'Бүттү же өткөрүлдү', 'Tamamlandı veya atlandı', '已完成或已跳过')), b('version', 'integer', L('Версия тура', 'Tour version', 'Турдун версиясы', 'Tur sürümü', '导览版本')), b('disabled', 'boolean', L('«Не показывать туры»', '“Do not show tours”', '«Турларды көрсөтпөө»', '“Turları gösterme”', '“不再显示导览”'))] },
  'GET /account/ui': { summary: L('Настройки оформления', 'Interface preferences', 'Интерфейс жөндөөлөрү', 'Arayüz tercihleri', '界面偏好'), response: { success: true, ui: { motion: 'auto', toursOff: false, custom: { image: null, accent: '#1E3A6E', scheme: 'light', dim: 70, blur: 6 } } } },
  'PUT /account/ui': { summary: L('Изменить настройки оформления', 'Change interface preferences', 'Интерфейс жөндөөлөрүн өзгөртүү', 'Arayüz tercihlerini değiştir', '修改界面偏好'), body: [b('motion', '"auto" | "off"', L('Анимация фона', 'Animated backgrounds', 'Фондун анимациясы', 'Hareketli arka planlar', '动态背景')), b('toursOff', 'boolean', L('Не показывать туры', 'Do not show tours', 'Турларды көрсөтпөө', 'Turları gösterme', '不显示导览')), b('custom', 'object', L('Своя тема: image, accent, scheme, dim, blur', 'Custom theme: image, accent, scheme, dim, blur', 'Өз темасы: сүрөт, акцент, схема, күңүрттөтүү, бүдөмүктөтүү', 'Özel tema: resim, vurgu, şema, karartma, bulanıklık', '自定义主题：图片、强调色、配色、暗化、模糊'))] },
  'GET /account/notifications': { summary: L('Настройки уведомлений', 'Notification preferences', 'Билдирмелердин жөндөөлөрү', 'Bildirim tercihleri', '通知偏好') },
  'PUT /account/notifications': { summary: L('Изменить настройки уведомлений', 'Change notification preferences', 'Билдирмелердин жөндөөлөрүн өзгөртүү', 'Bildirim tercihlerini değiştir', '修改通知偏好') },

  // ── Notifications ──
  'GET /notifications/': {
    summary: L('Список уведомлений', 'Notifications', 'Билдирмелер', 'Bildirimler', '通知'),
    query: [q('limit', 'integer', L('Сколько вернуть, до 50 (20)', 'How many, up to 50 (20)', 'Канча, 50гө чейин (20)', 'Kaç tane, en fazla 50 (20)', '数量，最多 50（20）')), q('before', 'integer', L('id, с которого продолжить (страницы)', 'Continue before this id (paging)', 'Ушул id\'ге чейинкилерди улантуу (барактоо)', 'Bu id\'den öncesiyle devam et (sayfalama)', '从此 id 之前继续（分页）')), q('unread', '"1"', L('Только непрочитанные', 'Unread only', 'Окулбагандар гана', 'Yalnızca okunmamışlar', '仅未读'))],
    response: { success: true, unread: 3, more: false, items: [{ id: 501, kind: 'security.new_login', title: 'New sign-in', body: 'Chrome on Windows', link: '/account/sessions', readAt: null, createdAt: '2026-10-11T09:12:00.000Z' }] },
  },
  'GET /notifications/unread': { summary: L('Число непрочитанных', 'Unread count', 'Окулбагандардын саны', 'Okunmamış sayısı', '未读数量'), response: { success: true, unread: 3 } },
  'POST /notifications/read': { summary: L('Отметить прочитанными', 'Mark as read', 'Окулду деп белгилөө', 'Okundu olarak işaretle', '标记为已读'), body: [b('ids', 'integer[]', L('Какие уведомления', 'Which notifications', 'Кайсы билдирмелер', 'Hangi bildirimler', '哪些通知')), b('all', 'boolean', L('Все сразу', 'All of them', 'Баары', 'Tümü', '全部'))], response: { success: true, unread: 0 } },

  // ── Tasks ──
  'GET /app/files/': { summary: L('Пространства и квота', 'Spaces and quota', 'Мейкиндиктер жана квота', 'Alanlar ve kota', '空间和配额') },
  'GET /app/files/my': { summary: L('Мои файлы (корень)', 'My files (root)', 'Менин файлдарым (тамыр)', 'Dosyalarım (kök)', '我的文件（根目录）') },
  'GET /app/files/folders/:id': { summary: L('Содержимое папки', 'Folder contents', 'Папканын мазмуну', 'Klasör içeriği', '文件夹内容') },
  'GET /app/files/spaces/:id/files': { summary: L('Корень пространства', 'Space root', 'Мейкиндиктин тамыры', 'Alan kökü', '空间根目录') },
  'POST /app/files/folders': { summary: L('Создать папку', 'Create a folder', 'Папка түзүү', 'Klasör oluştur', '创建文件夹'), body: [b('name', 'string', L('Название', 'Name', 'Аталышы', 'Ad', '名称'), { required: true }), b('parentId', 'integer', L('В папке', 'Inside a folder', 'Папканын ичинде', 'Bir klasörün içinde', '在文件夹内')), b('spaceId', 'integer', L('В корне пространства', 'At a space root', 'Мейкиндиктин тамырында', 'Bir alanın kökünde', '在空间根目录'))] },
  'POST /app/files/folders/tree': {
    summary: L('Создать дерево папок (загрузка папки)', 'Create a folder tree (folder upload)', 'Папкалардын дарагын түзүү (папканы жүктөө)', 'Klasör ağacı oluştur (klasör yükleme)', '创建文件夹树（上传文件夹）'),
    description: L('Создаёт недостающие папки по относительным путям; существующие папки с тем же именем используются повторно. Ответ `folders` — id папок в порядке `paths`. Затем файлы загружаются через `POST /app/files/upload?parentId=<id>`.', 'Creates the missing folders of relative paths; existing folders with the same name are reused. `folders` holds the folder ids in the order of `paths`. Files then go up via `POST /app/files/upload?parentId=<id>`.', 'Салыштырмалуу жолдордогу жок папкаларды түзөт; ошол эле аталыштагы бар папкалар кайра колдонулат. `folders` папкалардын id\'лерин `paths` тартибинде камтыйт. Андан кийин файлдар `POST /app/files/upload?parentId=<id>` аркылуу жүктөлөт.', 'Göreli yollardaki eksik klasörleri oluşturur; aynı addaki mevcut klasörler yeniden kullanılır. `folders`, klasör id\'lerini `paths` sırasıyla içerir. Dosyalar ardından `POST /app/files/upload?parentId=<id>` ile yüklenir.', '创建相对路径中缺失的文件夹；同名的现有文件夹会被复用。`folders` 按 `paths` 的顺序包含文件夹 id。随后通过 `POST /app/files/upload?parentId=<id>` 上传文件。'),
    body: [b('paths', 'string[]', L('Пути папок: "Фото", "Фото/2026" (до 1000, до 32 уровней)', 'Folder paths: "Photos", "Photos/2026" (up to 1000, 32 levels)', 'Папкалардын жолдору: "Photos", "Photos/2026" (1000ге чейин, 32 деңгээл)', 'Klasör yolları: "Photos", "Photos/2026" (en fazla 1000, 32 düzey)', '文件夹路径："Photos"、"Photos/2026"（最多 1000 个，32 级）'), { required: true }), b('parentId', 'integer', L('В папке', 'Inside a folder', 'Папканын ичинде', 'Bir klasörün içinde', '在文件夹内')), b('spaceId', 'integer', L('В корне пространства', 'At a space root', 'Мейкиндиктин тамырында', 'Bir alanın kökünde', '在空间根目录')), b('bytes', 'integer', L('Общий размер файлов — заранее сверяется с квотой', 'Total size of the files, checked against the quota up front', 'Файлдардын жалпы көлөмү, квота менен алдын ала текшерилет', 'Dosyaların toplam boyutu, önceden kotaya göre denetlenir', '文件总大小，预先按配额检查'))],
    example: { parentId: 42, paths: ['Photos', 'Photos/2026'], bytes: 1048576 },
  },
  'POST /app/files/upload': {
    summary: L('Загрузить файлы', 'Upload files', 'Файлдарды жүктөө', 'Dosya yükle', '上传文件'),
    description: L('`multipart/form-data`, поле `files`. Куда — параметрами `?parentId=` или `?spaceId=` (без них — в «Мои файлы»).', '`multipart/form-data`, field `files`. Target via `?parentId=` or `?spaceId=` (none = My files).', '`multipart/form-data`, `files` талаасы. Максат `?parentId=` же `?spaceId=` аркылуу (жок болсо — Менин файлдарым).', '`multipart/form-data`, `files` alanı. Hedef `?parentId=` veya `?spaceId=` ile (hiçbiri yoksa Dosyalarım).', '`multipart/form-data`，字段 `files`。目标通过 `?parentId=` 或 `?spaceId=` 指定（都不传则为“我的文件”）。'),
    query: [q('parentId', 'integer', L('Папка', 'Folder', 'Папка', 'Klasör', '文件夹')), q('spaceId', 'integer', L('Пространство', 'Space', 'Мейкиндик', 'Alan', '空间'))],
  },
  'GET /app/files/nodes/:id/file': { summary: L('Скачать файл', 'Download a file', 'Файлды жүктөп алуу', 'Dosya indir', '下载文件'), query: [q('download', '"1"', L('Как вложение', 'As an attachment', 'Тиркеме катары', 'Ek olarak', '作为附件'))] },
  'GET /app/files/search': { summary: L('Поиск по имени', 'Search by name', 'Аталыш боюнча издөө', 'Ada göre ara', '按名称搜索'), query: [q('q', 'string', L('От 2 символов', 'At least 2 characters', 'Кеминде 2 белги', 'En az 2 karakter', '至少 2 个字符'), { required: true })] },

  // ── Drive ──
  'GET /app/kb/tree': { summary: L('Дерево папок', 'Folder tree', 'Папкалардын дарагы', 'Klasör ağacı', '文件夹树') },
  'GET /app/kb/search': { summary: L('Поиск', 'Search', 'Издөө', 'Ara', '搜索'), query: [q('q', 'string', L('Текст', 'Text', 'Текст', 'Metin', '文本'), { required: true })] },
  'GET /app/kb/items/:id': { summary: L('Материал', 'Item', 'Материал', 'İçerik', '内容') },
  'POST /app/kb/items': {
    summary: L('Создать материал', 'Create an item', 'Материал түзүү', 'İçerik oluştur', '创建内容'),
    body: [
      b('folderId', 'integer', L('Папка', 'Folder', 'Папка', 'Klasör', '文件夹'), { required: true }),
      b('kind', 'string', L('article или link', 'article or link', 'article же link', 'article veya link', 'article 或 link')),
      b('title', 'string', L('Заголовок', 'Title', 'Аталыш', 'Başlık', '标题'), { required: true }),
      b('content', 'string', L('Текст статьи; файлы — kbfile:<id>', 'Article body; files as kbfile:<id>', 'Макаланын тексти; файлдар kbfile:<id> түрүндө', 'Makale gövdesi; dosyalar kbfile:<id> olarak', '文章正文；文件写作 kbfile:<id>')),
      b('format', 'string', L('md (Markdown, по умолчанию) или html (визуальный редактор)', 'md (Markdown, default) or html (visual editor)', 'md (Markdown, демейки) же html (визуалдык редактор)', 'md (Markdown, varsayılan) veya html (görsel düzenleyici)', 'md（Markdown，默认）或 html（可视化编辑器）')),
      b('url', 'string', L('Адрес для ссылки', 'Address of a link', 'Шилтеменин дареги', 'Bağlantının adresi', '链接地址')),
    ],
  },
  'POST /app/kb/folders/:id/media': { summary: L('Загрузить картинки и файлы для статьи', 'Upload pictures and files for an article', 'Макала үчүн сүрөттөрдү жана файлдарды жүктөө', 'Bir makale için resim ve dosya yükle', '为文章上传图片和文件'), description: L('multipart, поле files. Файлы прикрепляются к статье, когда она сохранена с kbfile:<id> в тексте.', 'multipart, field files. Files are attached when the article is saved with kbfile:<id> in its body.', 'multipart, files талаасы. Файлдар макала тексттеги kbfile:<id> менен сакталганда тиркелет.', 'multipart, files alanı. Dosyalar, makale gövdesinde kbfile:<id> ile kaydedildiğinde eklenir.', 'multipart，字段 files。文章以 kbfile:<id> 引用保存时，文件即被附加。') },

  // ── Dashboard ──
  'GET /app/dashboard/': { summary: L('Мои виджеты', 'My widgets', 'Менин виджеттерим', 'Pencere öğelerim', '我的小组件') },
  'GET /app/dashboard/data/:type': { summary: L('Данные виджета', 'Widget data', 'Виджеттин маалыматтары', 'Pencere öğesi verileri', '小组件数据') },

  // ── Admin: users ──
  'GET /admin/users': { summary: L('Пользователи', 'Users', 'Колдонуучулар', 'Kullanıcılar', '用户'), response: { success: true, users: [{ id: 7, username: 'aida', displayName: 'Aida Bekova', email: 'aida@example.com', isActive: true, roles: [{ key: 'user' }], groups: [{ id: 2, name: 'Sales' }] }] } },
  'POST /admin/users': {
    summary: L('Создать пользователя', 'Create a user', 'Колдонуучу түзүү', 'Kullanıcı oluştur', '创建用户'),
    description: L('Подходит для синхронизации с кадровой системой.', 'Suits syncing with an HR system.', 'HR системасы менен синхрондоого ылайыктуу.', 'Bir İK sistemiyle eşitleme için uygundur.', '适合与 HR 系统同步。'),
    body: [b('username', 'string', L('Логин', 'Login', 'Логин', 'Kullanıcı adı', '登录名'), { required: true }), b('displayName', 'string', L('Имя', 'Name', 'Аты', 'Ad', '名称')), b('email / phone', 'string', L('Контакты', 'Contacts', 'Байланыштар', 'Kişiler', '联系人')), b('password', 'string', L('Пароль (необязательно — вход по коду или AD)', 'Password (optional: code or AD sign-in)', 'Сырсөз (милдеттүү эмес: код же AD аркылуу кирүү)', 'Parola (isteğe bağlı: kod veya AD ile oturum açma)', '密码（可选：验证码或 AD 登录）')), b('roleIds / groupIds', 'integer[]', L('Роли и группы', 'Roles and groups', 'Ролдор жана топтор', 'Roller ve gruplar', '角色和组'))],
    example: { username: 'n.ivanova', displayName: 'Nadezhda Ivanova', email: 'n.ivanova@example.com', groupIds: [2] },
  },
  'GET /admin/users/:id': { summary: L('Пользователь', 'User', 'Колдонуучу', 'Kullanıcı', '用户') },
  'PUT /admin/users/:id': { summary: L('Изменить пользователя', 'Update a user', 'Колдонуучуну өзгөртүү', 'Kullanıcıyı güncelle', '更新用户'), body: [b('isActive', 'boolean', L('Включён', 'Enabled', 'Күйгүзүлгөн', 'Etkin', '已启用')), b('isBlocked', 'boolean', L('Заблокирован', 'Blocked', 'Бөгөттөлгөн', 'Engellendi', '已封禁')), b('displayName / email / phone / locale', 'string', L('Поля профиля', 'Profile fields', 'Профилдин талаалары', 'Profil alanları', '个人资料字段')), b('password', 'string', L('Новый пароль', 'New password', 'Жаңы сырсөз', 'Yeni parola', '新密码')), b('roleIds / groupIds', 'integer[]', L('Роли и группы', 'Roles and groups', 'Ролдор жана топтор', 'Roller ve gruplar', '角色和组'))] },
  'DELETE /admin/users/:id': { summary: L('Удалить пользователя', 'Delete a user', 'Колдонуучуну өчүрүү', 'Kullanıcıyı sil', '删除用户') },
  'GET /admin/groups': { summary: L('Группы', 'Groups', 'Топтор', 'Gruplar', '组') },
  'POST /admin/groups': { summary: L('Создать группу', 'Create a group', 'Топ түзүү', 'Grup oluştur', '创建组'), body: [b('name', 'string', L('Название', 'Name', 'Аталышы', 'Ad', '名称'), { required: true }), b('description', 'string', L('Описание', 'Description', 'Сүрөттөмө', 'Açıklama', '描述')), b('roleIds', 'integer[]', L('Роли группы', 'Roles of the group', 'Топтун ролдору', 'Grubun rolleri', '组的角色')), b('isDefault', 'boolean', L('Новые пользователи попадают в неё', 'New users join it', 'Жаңы колдонуучулар ага кошулат', 'Yeni kullanıcılar bu gruba katılır', '新用户会加入此组'))] },
  'GET /admin/roles': { summary: L('Роли', 'Roles', 'Ролдор', 'Roller', '角色') },
  'GET /admin/permissions': { summary: L('Каталог прав', 'Permission catalog', 'Укуктардын каталогу', 'İzin kataloğu', '权限目录') },
  'GET /admin/security/events': { summary: L('События безопасности', 'Security events', 'Коопсуздук окуялары', 'Güvenlik olayları', '安全事件'), query: [q('kind', 'string', L('Тип', 'Kind', 'Түрү', 'Tür', '类型')), q('limit', 'integer', L('Сколько', 'How many', 'Канча', 'Kaç tane', '数量'))] },
  'GET /admin/system': { summary: L('Версия, база, аптайм', 'Version, database, uptime', 'Версия, маалымат базасы, иштөө убактысы', 'Sürüm, veritabanı, çalışma süresi', '版本、数据库、运行时长') },
  'GET /admin/overview': { summary: L('Сводка администратора', 'Administrator overview', 'Администратордун сереби', 'Yönetici genel bakışı', '管理员概览') },
};

/** Reusable explanations shown in the guide part of the developer portal. */
export const ERRORS = [
  { status: 400, code: 'VALIDATION', text: L('Неверные данные запроса; в `error` — что именно.', 'Invalid request data; `error` says what.', 'Суроо-талаптын маалыматтары туура эмес; `error` эмнеси экенин айтат.', 'Geçersiz istek verisi; `error` neyin hatalı olduğunu söyler.', '请求数据无效；`error` 说明原因。') },
  { status: 401, code: 'TOKEN_INVALID', text: L('Токен не найден или повреждён.', 'The token is unknown or malformed.', 'Токен белгисиз же туура эмес форматта.', 'Belirteç bilinmiyor veya hatalı biçimde.', '令牌未知或格式错误。') },
  { status: 401, code: 'TOKEN_EXPIRED', text: L('Срок действия токена истёк.', 'The token has expired.', 'Токендин мөөнөтү бүттү.', 'Belirtecin süresi doldu.', '令牌已过期。') },
  { status: 401, code: 'TOKEN_REVOKED', text: L('Токен отозван.', 'The token was revoked.', 'Токен кайтарылып алынды.', 'Belirteç iptal edildi.', '令牌已被吊销。') },
  { status: 403, code: 'SCOPE_DENIED', text: L('У токена нет нужной области (`scope`) или запрос запрещён правилом (`rule`).', 'The token lacks the needed `scope`, or a `rule` denies the request.', 'Токенде керектүү `scope` жок, же `rule` суроо-талапты тыюу салат.', 'Belirteçte gerekli `scope` yok veya bir `rule` isteği reddediyor.', '令牌缺少所需的 `scope`，或某条 `rule` 拒绝了该请求。') },
  { status: 403, code: 'ROUTE_NOT_AVAILABLE', text: L('Эндпоинт недоступен токенам (вход, пароли, управление токенами).', 'Not available to tokens (sign-in, passwords, token management).', 'Токендер үчүн жеткиликсиз (кирүү, сырсөздөр, токендерди башкаруу).', 'Belirteçler için kullanılamaz (oturum açma, parolalar, belirteç yönetimi).', '令牌不可用（登录、密码、令牌管理）。') },
  { status: 403, code: 'IP_NOT_ALLOWED', text: L('Адрес не входит в список разрешённых для токена.', "The address is not in the token's allow list.", 'Дарек токендин ак тизмесинде жок.', 'Adres, belirtecin izin listesinde değil.', '该地址不在令牌的白名单中。') },
  { status: 403, code: 'FORBIDDEN', text: L('У владельца токена нет прав на действие.', 'The token owner may not do this.', 'Токендин ээсине бул аракетке уруксат жок.', 'Belirteç sahibi bunu yapamaz.', '令牌所有者无权执行此操作。') },
  { status: 403, code: 'OWNER_INACTIVE', text: L('Учётная запись владельца отключена.', "The owner's account is disabled.", 'Ээсинин эсептик жазуусу өчүрүлгөн.', 'Sahibin hesabı devre dışı.', '所有者的账户已停用。') },
  { status: 404, code: 'NOT_FOUND', text: L('Не найдено или нет доступа.', 'Not found, or no access.', 'Табылган жок же кирүү укугу жок.', 'Bulunamadı veya erişim yok.', '未找到或无访问权限。') },
  { status: 404, code: 'MODULE_DISABLED', text: L('Модуль выключен.', 'The module is turned off.', 'Модуль өчүрүлгөн.', 'Modül kapalı.', '模块已关闭。') },
  { status: 429, code: 'RATE_LIMITED', text: L('Превышен лимит запросов; подождите `retryAfter` секунд.', 'Rate limit exceeded; wait `retryAfter` seconds.', 'Суроо-талаптардын чеги ашты; `retryAfter` секунд күтүңүз.', 'Hız sınırı aşıldı; `retryAfter` saniye bekleyin.', '超出请求频率限制；请等待 `retryAfter` 秒。') },
  { status: 503, code: 'API_DISABLED', text: L('API выключен администратором.', 'The API is turned off by the administrator.', 'API\'ни администратор өчүргөн.', 'API yönetici tarafından kapatıldı.', 'API 已被管理员关闭。') },
];
