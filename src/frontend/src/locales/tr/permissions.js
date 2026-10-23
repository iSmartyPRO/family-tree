export default {
  groups: {
    console: 'Konsol',
    people: 'Kişiler ve erişim',
    audit: 'Denetim',
    settings: 'Ayarlar',
    module_kb: 'Bilgi bankası',
    module_family: 'Soy ağacı',
    module_files: 'Dosyalar',
    module_dashboard: 'Pano',
    api: 'API',
  },
  console_access: {
    title: 'Yönetim konsolunu açma',
    desc: '/admin içindeki her iş için gereklidir.',
  },
  users_view: {
    title: 'Kullanıcıları görüntüleme',
    desc: 'Hesapları, grupları ve rolleri görme.',
  },
  users_manage: {
    title: 'Kullanıcıları yönetme',
    desc: 'Hesap oluşturma, profil düzenleme, parola sıfırlama, engelleme, kendinde olan grupları ve rolleri atama.',
  },
  users_delete: {
    title: 'Kullanıcıları silme',
    desc: 'Hesapları kalıcı olarak kaldırma.',
  },
  groups_manage: {
    title: 'Grupları yönetme',
    desc: 'Grup oluşturma, rollerini ve üyelerini belirleme.',
  },
  roles_manage: {
    title: 'Rolleri yönetme',
    desc: 'Rol oluşturma ve hangi izinleri verdiklerini değiştirme.',
  },
  activity_view: {
    title: 'Günlüğü görüntüleme',
    desc: 'Güvenlik olayları ve oturum açma geçmişi.',
  },
  settings_view: {
    title: 'Ayarları görüntüleme',
    desc: 'Tüm ayar ekranlarını değiştirmeden okuma.',
  },
  settings_general: {
    title: 'Marka ve görünüm',
    desc: 'Ad, logolar, tema, tipografi, simgeler.',
  },
  settings_security: {
    title: 'Güvenlik ilkesi',
    desc: 'Site erişimi, kilitlemeler, oturumlar, IP filtreleme.',
  },
  settings_auth: {
    title: 'Oturum açma yöntemleri',
    desc: 'Parola, Active Directory, Telegram, tek kullanımlık kodlar.',
  },
  settings_integrations: {
    title: 'Entegrasyonlar',
    desc: 'E-posta, Telegram, WhatsApp, Wazzup, Active Directory.',
  },
  settings_system: {
    title: 'Sistem',
    desc: 'API istek sınırları ve çalışma ortamı bilgileri.',
  },
  settings_modules: {
    title: 'Modüller',
    desc: 'Modülleri açma veya kapatma ve sistem ayarlarını değiştirme.',
  },
  kb_admin: {
    title: 'Bilgi bankası yöneticisi',
    desc: 'Klasör erişiminden bağımsız olarak tüm klasör ve materyallere tam erişim.',
  },
  files_admin: {
    title: 'Dosya yöneticisi',
    desc: 'Tüm paylaşılan alanları ve erişimlerini yönetme. Kişisel dosyalar gizli kalır.',
  },
  dashboard_admin: {
    title: 'Pano yöneticisi',
    desc: 'Herkesin, kendi düzenini yapana kadar göreceği başlangıç panosunu belirleme.',
  },
  api_tokens: {
    title: 'Kişisel API belirteçleri',
    desc: 'Kendi izinlerinizle, kapsamlarla daraltılmış olarak çalışan belirteçler oluşturma.',
  },
  api_admin: {
    title: 'API yönetimi',
    desc: 'Herkesin belirteçleri, erişim şablonları, web kancaları, istek günlüğü ve API ayarları.',
  },
  ad_view: {
    title: 'AD dizini: görüntüleme',
    desc: 'Yönetilen kök altındaki OU’ları, kullanıcıları, grupları ve bilgisayarları, günlüğü inceleme.',
  },
  ad_manage: {
    title: 'AD dizini: hesapları yönetme',
    desc: 'Kullanıcı oluşturma, öznitelik düzenleme, taşıma, etkinleştirme / devre dışı bırakma, kilit açma, grup üyeliği (klasör erişim grupları hariç). Yöneticinin kendi AD hesabıyla çalışır.',
  },
  ad_passwords: {
    title: 'AD dizini: parola sıfırlama',
    desc: 'Parolaları sıfırlama («sonraki oturum açışta değiştirmeli» ile) ve hesapların kilidini açma. LDAPS veya StartTLS gerekir.',
  },
  ad_admin: {
    title: 'AD dizini: yönetici',
    desc: 'Korumalı (yönetici) hesaplar dahil modüldeki her şey.',
  },
  family_admin: {
    title: 'Soy ağacı yöneticisi',
    desc: 'Erişim listesinden bağımsız olarak tüm soy ağaçlarına tam erişim.',
  },
};
