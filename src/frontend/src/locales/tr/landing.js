// Tek sayfalık ana sayfanın metinleri (pages/Home.jsx). Yeni bir proje için bunları burada değiştirin.
export default {
  navLabel: 'Sayfa bölümleri',
  nav: {
    features: 'Özellikler',
    how: 'Nasıl çalışır',
    faq: 'SSS',
    contact: 'İletişim',
  },
  kicker: 'Yeni proje',
  title: 'Tek cümlede ürün: hangi sorunu kimin için çözüyor.',
  subtitle: 'Ana değer hakkında bir iki cümle buraya gelir. Yukarıdaki ad ve açıklama Ayarlar → Genel bölümünden alınır.',
  ctaLogin: 'Giriş yap',
  ctaAccount: 'Hesabı aç',
  ctaAdmin: 'Yönetim',
  ctaMore: 'Daha fazla',
  facts: [
    { value: '24/7', label: 'Tarayıcıdan ve telefondan erişim' },
    { value: '5', label: 'Arayüz dili' },
    { value: 'SSO', label: 'AD, Google, Telegram ile giriş' },
  ],
  features: {
    kicker: 'Özellikler',
    title: 'Ürün neler yapar',
    lead: 'Üç ila altı temel özelliği anlatın. Simgeler menü simge setinden gelir (components/icons).',
    items: [
      { icon: 'shield', title: 'Güvenli giriş', text: 'Parola, e-posta, Telegram veya WhatsApp ile kodlar, Active Directory ve Google — ayarlardan açılır.' },
      { icon: 'people', title: 'Roller ve yetkiler', text: 'Her bölüm için kesin yetkilere sahip kullanıcılar, gruplar ve roller.' },
      { icon: 'integrations', title: 'Entegrasyonlar', text: 'E-posta, mesajlaşma uygulamaları, Google ve diğer sistemler için webhook\'lu API belirteçleri.' },
      { icon: 'file', title: 'Bilgi bankası ve dosyalar', text: 'Rol tabanlı erişim ve herkese açık bağlantılarla makaleler, kılavuzlar ve belgeler.' },
      { icon: 'palette', title: 'Sizin tarzınız', text: 'Renk şablonları, yazı tipleri, logolar ve koyu tema — koda dokunmadan.' },
      { icon: 'globe', title: 'Çalışmaya hazır', text: 'Docker, PostgreSQL, ilk kurulum sihirbazı ve telefona kurulacak bir PWA.' },
    ],
  },
  how: {
    kicker: 'Nasıl çalışır',
    title: 'Sonuca üç adım',
    lead: 'Kullanıcının yolunu anlatın: ilk girişten üründen fayda sağlamaya kadar.',
    steps: [
      { title: 'Kayıt', text: 'Yönetici kişileri davet eder veya kurumsal hesaplarla girişi açar.' },
      { title: 'Ayarlama', text: 'Süreçlerinize uyan modülleri, yetkileri ve entegrasyonları seçin.' },
      { title: 'Çalışma', text: 'Ekip ürünü tarayıcıda veya telefondaki uygulamada kullanır.' },
    ],
  },
  faq: {
    kicker: 'SSS',
    title: 'Sık sorulan sorular',
    lead: 'Başlamadan önce sorulanlara yanıtlar.',
    items: [
      { q: 'Veriler nerede saklanır?', a: 'Sizin sunucunuzda: uygulama ve PostgreSQL kendi altyapınızda Docker içinde çalışır.' },
      { q: 'Site yabancılara kapatılabilir mi?', a: 'Evet. «Kapalı» modda ziyaretçiler yalnızca giriş formunu görür; «Açık» modda bu sayfayı.' },
      { q: 'Kurumsal girişi nasıl bağlarım?', a: 'Ayarlar → Giriş yöntemleri bölümünden Active Directory, Google veya kodla girişi açın.' },
      { q: 'Mobil uygulama var mı?', a: 'Portal telefona uygulama (PWA) olarak kurulur ve anlık bildirimler gönderir.' },
    ],
  },
  contact: {
    title: 'Başlamaya hazır mısınız?',
    text: 'Giriş yapın veya bize yazın — bağlanmanıza yardımcı olalım.',
    cta: 'Giriş yap',
    email: 'hello@example.com',
  },
};
