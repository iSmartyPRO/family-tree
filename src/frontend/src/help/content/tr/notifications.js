export default {
  title: 'Bildirimler',
  tagline: 'Portal size neyi, nereye ve ne zaman bildirir',
  summary: 'Portal, dosyalar ve klasörler sizinle paylaşıldığında ve biri herkese açık bağlantılarınızı kullandığında size haber verir. Her şey her zaman zile düşer; anlık bildirim, e-posta, Telegram, WhatsApp ve Mattermost’a başka nelerin gideceğine siz karar verirsiniz: olay bazında, sessiz saatler ve duraklatma ile.',
  highlights: [
    {
      title: 'Zil',
      text: 'Tüm bildirimler üst bilgide, okunmamış sayacıyla tek yerde.',
    },
    {
      title: 'Anlık bildirimler ve mesajlaşma uygulamaları',
      text: 'Telefona ve bilgisayara anlık bildirim, e-posta, Telegram, WhatsApp ve Mattermost — hangileri bağlıysa.',
    },
    {
      title: 'Olay bazında',
      text: 'Bir “olay × kanal” tablosu: örneğin paylaşılan dosyalar her yere, bağlantı etkinliği yalnızca anlık bildirim olarak.',
    },
    {
      title: 'Sessiz saatler ve duraklatma',
      text: 'Geceleri veya hafta sonları anlık bildirim ya da mesaj yok; bir saatliğine veya sabaha kadar duraklatın.',
    },
    {
      title: 'Test ve geçmiş',
      text: 'Her kanaldan bir test ve bir geçmiş: her bildirimin nereye gittiği ve neden ulaşmadığı.',
    },
  ],
  tips: [
    '“Test gönder” ile başlayın — hangi kanalların çalıştığını hemen görürsünüz.',
    'Telefonda anlık bildirimler, portal uygulama olarak yüklendiğinde en iyi şekilde çalışır.',
    'Çok mu fazla mesaj? “Hazır ayarlar” → “Yalnızca önemliler”.',
  ],
  sections: [
    {
      title: 'Kanallar: bildirimler nereye gider',
      body: `- Üst bilgideki **zil** — her zaman, hiçbir şey kaybolmaz.
- **Anlık bildirimler** — telefonda ve bilgisayarda açılır bildirimler. Her cihaz için [bildirim ayarlarından](/account/notifications) açılır (“Bu cihazda anlık bildirimler”). iPhone’da anlık bildirimler yalnızca yüklü uygulamada çalışır (Paylaş → “Ana Ekrana Ekle”).
- **E-posta** — [profilinizdeki](/account) adrese.
- **Telegram** — hesabınızı [Profil → Güvenlik](/account/security) bölümünden bağlayın.
- **WhatsApp** — [profilinize](/account) cep telefonunuzu ekleyin; mesajlar o numaraya gider (yönetici WhatsApp’ı bağladıysa).
- **Mattermost** — [profilinize](/account) Mattermost adınızı girin.

Kanal kartı durumunu gösterir: “Açık”, “Kapalı” (sizin tarafınızdan) veya “Bağlı değil” — bağlamak için bir bağlantıyla. Kapatılmış bir kanala hiçbir şey gitmez.`,
      steps: [
        '[Profil → Bildirimler](/account/notifications) bölümünü açın.',
        'İstediğiniz kanalları kartlardaki bağlantılarla bağlayın.',
        '**Test gönder**’e tıklayın — her kanal “iletildi” bilgisini veya başarısızlık nedenini gösterir.',
      ],
    },
    {
      title: 'Ne hakkında bildirim alacağınız',
      body: `“Ne hakkında” tablosunda satırlar olaylardır (sizinle bir dosya veya klasör paylaşıldı, biri herkese açık bağlantınız üzerinden dosya yükledi…), sütunlar kanallardır. Her olayın nereye gitmesini istediğinizi işaretleyin. Gri sütunlar bağlı olmayan veya kapatılmış kanallardır.

**“Zil”** sütunu portalın zilidir. Bir olaya hiç ihtiyacınız yoksa işaretini kaldırın.

**Hazır ayarlar** tüm tabloyu bir kerede değiştirir: “Önerilen”, “Yalnızca önemliler”, “Her şey her yerde”, “Yalnızca zil”.`,
      example: {
        title: 'Daha az e-posta, önemli hiçbir şey kaçmadan',
        body: '“Hazır ayarlar” → “Yalnızca önemliler”i seçin: önemli olaylar e-postaya ve Telegram’a, geri kalanı yalnızca zile gider. Ardından bir müşterinin dosya gönderdiğini görmek istiyorsanız “Herkese açık bağlantılarınız üzerinden yüklemeler ve değişiklikler” için anlık bildirimi işaretleyin.',
      },
    },
    {
      title: 'Sessiz saatler ve duraklatma',
      body: `**Sessiz saatler** — örneğin 22:00’den 08:00’e ve tüm hafta sonu — anlık bildirimleri, e-postayı ve mesajlaşma uygulamalarını sessiz tutar. **Duraklatma** aynısını bir süreliğine yapar: bir saat, 3 saat, yarın sabaha kadar veya pazartesiye kadar.

Zil her şeyi toplamaya devam eder, böylece sabah neler olduğunu görürsünüz.

Sessiz saatler ve duraklatma saat diliminize göre çalışır — saat dilimini [Görünüm → Tarih ve saat](/account/appearance) bölümünden değiştirin.`,
      note: 'Sessiz saatler tarayıcınızın saat dilimini kullanır — ayarları değiştirdiğinizde kaydedilir.',
    },
    {
      title: 'İletim geçmişi',
      body: 'Bildirim ayarlarının en altında, kanal başına bir işaretle son bildirimler bulunur: yeşil — iletildi, gri — kullanılmadı (kapalı, bağlı değil, sessiz saatler), kırmızı — başarısız. Nedeni okumak için işaretin üzerine gelin.',
    },
  ],
  faq: [
    {
      q: 'Telegram’a hiçbir şey gelmiyor',
      a: 'Telegram’ı [Profil → Güvenlik](/account/security) bölümünden bağlayın, ardından [bildirimlerde](/account/notifications) Telegram kartını açın ve “Test gönder”e tıklayın. Kartta “Kullanılamıyor” yazıyorsa yönetici henüz botu ayarlamamıştır.',
    },
    {
      q: 'Telefonumda anlık bildirim yok',
      a: 'Bildirim ayarlarını telefonun kendisinde açın ve “Bu cihazda anlık bildirimler”i açın. iPhone’da önce portalı Ana Ekrana ekleyin ve oradan açın. Telefonun ayarlarında tarayıcı/uygulama için bildirimlere izin verildiğini kontrol edin.',
    },
    {
      q: 'Nasıl daha az bildirim alırım?',
      a: '“Hazır ayarlar” → “Yalnızca önemliler”, sessiz saatleri açın ve tablodaki belirli olayların işaretini kaldırın.',
    },
    {
      q: 'Sessiz saatlerde bildirimler kaybolur mu?',
      a: 'Hayır. Her zaman zildedirler; sessiz saatler yalnızca anlık bildirimleri, e-postayı ve mesajlaşma uygulamalarını bekletir.',
    },
    {
      q: 'Bir bildirimin neden gelmediğini nerede görebilirim?',
      a: 'Bildirim ayarları → “Son bildirimler”de: bir kanal işaretinin üzerine gelin.',
    },
  ],
  fields: {
    channels: {
      title: 'Kanallar',
      text: 'Bildirimlerin zil dışında nereye gittiği. “Test gönder” bağlı her kanalı kontrol eder.',
    },
    quiet: {
      title: 'Sessiz saatler ve duraklatma',
      text: 'Bu sürede anlık bildirimler, e-posta ve mesajlaşma uygulamaları sessiz kalır; zil her şeyi toplar.',
    },
    events: {
      title: 'Olaylar ve kanallar',
      text: 'Her olayın nereye gideceğini işaretleyin. “Hazır ayarlar” her şeyi bir kerede değiştirir.',
    },
    subscriptions: {
      title: 'Abonelikler',
      text: 'Her öğeye katılmadan takip ettikleriniz. Aboneliği buradan istediğiniz zaman iptal edin.',
    },
  },
};
