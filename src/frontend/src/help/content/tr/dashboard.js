export default {
  title: 'Pano',
  tagline: 'Gününüz tek bakışta: bildirimler, dosyalar ve yeni materyaller tek sayfada.',
  summary: 'Pano, portalın diğer modüllerinden önemli olanları pencere öğeleri olarak bir araya getirir. Onları galeriden ekleyin, düzenleyin ve boyutlandırın, filtrelerini ayarlayın — her şey otomatik olarak kaydedilir.',
  highlights: [
    {
      title: 'Her şey için pencere öğeleri',
      text: 'Karşılama, bildirimler, son dosyalar, bilgi bankası, saat, not ve daha fazlası.',
    },
    {
      title: 'Yöneticiler için rakamlar',
      text: 'Hesaplar, etkinlik ve günlere göre oturum açmalar — tek bakışta, seçtiğiniz dönem için.',
    },
    {
      title: 'Sürükleyin ve boyutlandırın',
      text: 'Bir pencere öğesini başlığından sürükleyin, sağ alt köşesinden boyutlandırın.',
    },
    {
      title: 'Kendi ayarlarınız',
      text: 'Her pencere öğesinin kendi başlığı ve ayarları vardır: kaç öğe gösterileceği, dönem, şehirler, renk.',
    },
    {
      title: 'Yalnızca görebildikleriniz',
      text: 'Pencere öğeleri verileri sizin izinlerinizle gösterir — hiçbir zaman modülün kendisinden fazlasını değil.',
    },
    {
      title: 'Kendiliğinden kaydedilir',
      text: 'Değişiklikler otomatik olarak kaydedilir ve tüm cihazlarınızda görünür.',
    },
  ],
  tips: [
    'Aynı pencere öğesini birkaç kez ekleyin — örneğin farklı ofisler için iki “Dünya saati” kartı.',
    'Karıştırmamak için her kopyaya kendi başlığını verin: “Saat · Asya”, “Saat · Avrupa”.',
    'Bir pencere öğesini yanlışlıkla mı kaldırdınız? Açılan bildirimde “Geri al”a tıklayın — 5 saniyeniz var.',
    'Pencere öğesinin ⋯ menüsünde hazır boyutlar bulunur: küçük, orta, büyük, geniş, tam genişlik.',
    'Kayboldunuz mu? “Özelleştir” → “Sıfırla” başlangıç setini geri getirir.',
  ],
  sections: [
    {
      title: 'Pencere öğeleri ve verileri',
      body: `Pencere öğesi, portal modüllerinden birinin verilerini içeren bir karttır:

- **Karşılama** — tarih, bir selamlama ve kaç bildirimin okunmadığı;
- **Hızlı erişim** — portal modülleri büyük kutucuklar veya liste olarak;
- **Bildirimler** — “tümünü okundu yap” ile son bildirimler;
- **Son dosyalar** — son dosyalarınız ve ne kadar alan kullandığınız;
- **Bilgi bankası** — son güncellenen belgeler ve makaleler;
- **Kullanıcılar ve oturum açmalar** — hesaplar, etkinlik ve günlere göre oturum açmalar (kullanıcıları görüntüleme izni olanlar için);
- **Dünya saati** ve **Not**.

Veriler birkaç dakikada bir ve sekmeye döndüğünüzde yenilenir. Pencere öğeleri yalnızca modülün kendisinde görebildiklerinizi gösterir.`,
      note: 'Bir modül kapalıysa veya size açık değilse pencere öğeleri gösterilmez. Modül yeniden açıldığında yerlerine geri dönerler.',
    },
    {
      title: 'Galeriden pencere öğesi ekleme',
      body: `Galeri, size açık tüm pencere öğelerini kategorilere göre listeler: **Genel bakış**, **Dosyalar ve bilgi**, **Yönetim** ve **Araçlar**. Her birinin önizlemesi ve kısa açıklaması vardır; arama da bulunur.

Yeni pencere öğesi panonun en üstünde görünür ve kısa bir süre vurgulanır.`,
      steps: [
        'Sayfanın üstündeki **“Pencere öğesi ekle”**ye tıklayın.',
        'Soldan bir kategori seçin veya aramaya bir ad yazın.',
        'Pencere öğesi kartına tıklayın — panoya eklenir.',
        'Uyarlamak için pencere öğesindeki ⚙ simgesini açın.',
      ],
      example: {
        title: 'İki ofisin saatleri yan yana',
        body: 'Bir yönetici Asya ve Avrupa’daki ofislerle çalışıyor. “Dünya saati”ni iki kez ekler. Birincisinin ⚙ ayarlarında Asya şehirlerini seçer ve başlığını “Asya” yapar; ikincisinde Avrupa şehirlerini ve “Avrupa”yı. Artık iki saat yan yana durur.',
      },
    },
    {
      title: 'Taşıma ve boyutlandırma',
      body: `**“Özelleştir”** modunda:

- **taşıma** — pencere öğesini başlığından sürükleyin;
- **boyutlandırma** — sağ alt köşeyi sürükleyin; boyut ızgaraya oturur ve sürüklerken gösterilir;
- **hazır boyutlar** — ⋯ menüsü → “Boyut”: küçük, orta, büyük, geniş, tam genişlik.

Geniş ekranlarda 12 sütunlu, tabletlerde 6 sütunlu bir ızgara vardır. Boşluklar kendiliğinden kapanır. Özelleştirme modundan çıkmak için **“Bitti”**ye tıklayın.`,
      note: 'Panonun üstündeki durum “Kaydediliyor…”, “Kaydedildi ✓” gösterir. Kaydet’e basmanız gerekmez.',
    },
    {
      title: 'Pencere öğesi ayarları ve filtreler',
      body: `**⚙** düğmesi bir pencere öğesinin ayarlarını açar. Her pencere öğesinin bir **Başlığı** vardır — kart için kendi adınız. Gerisi pencere öğesine bağlıdır:

- **Karşılama** — okunmamış sayacının gösterilip gösterilmeyeceği;
- **Hızlı erişim** — hangi modüller, kutucuklar veya liste;
- **Bildirimler** — yalnızca okunmamışlar, kaç tane gösterileceği;
- **Son dosyalar** — kullanılan alanı gösterme, kaç tane gösterileceği;
- **Bilgi bankası** — kaç tane gösterileceği;
- **Kullanıcılar ve oturum açmalar** — dönem (7, 14, 30, 90 gün);
- **Dünya saati** — diğer şehirler (en fazla 6), 24/12 sa, analog saat;
- **Not** — renk.

Ayarlar penceresinde **“Kaydet”**e tıklayın — pencere öğesi hemen güncellenir.`,
      example: {
        title: 'Yalnızca okunmamışlar',
        body: 'Yalnızca henüz okumadıklarınızı izlemek için “Bildirimler”de ⚙ simgesini açın, **Yalnızca okunmamışlar**ı açın, **Gösterilecek sayı**yı 10 yapın ve pencere öğesine “Okunacaklar” başlığını verin.',
      },
    },
    {
      title: 'Çoğaltma, kaldırma, geri alma',
      body: `Özelleştirme modunda bir pencere öğesinin **⋯** menüsü:

- **Çoğalt** — aynı ayarlarla yanına bir kopya eklenir; başka bir filtreyle benzer bir pencere öğesi için kullanışlıdır;
- **Modülü aç** — verilerin geldiği modüle gidin;
- **Kaldır** — pencere öğesi kaybolur ve 5 saniye boyunca bir **“Geri al”** düğmesi görünür.

**“Sıfırla”** tüm pencere öğelerinizi, boyutlarınızı ve ayarlarınızı başlangıç setiyle değiştirir — portal önce sorar.`,
      note: 'Sıfırlama geri alınamaz. Emin değilseniz pencere öğelerini tek tek kaldırın.',
    },
    {
      title: 'Yöneticiden başlangıç seti',
      body: `Herhangi bir değişiklik yapana kadar **başlangıç setini** görürsünüz: karşılama, hızlı erişim, bildirimler, bilgi bankası, son dosyalar, dünya saati ve yöneticiler için kullanıcılar ve oturum açmalar. Kullanamadığınız modüllerin pencere öğeleri gizlenir.

Bir pano yöneticisi kendi panosunu, kendi panosu olmayan herkes için başlangıç panosu yapabilir: **“Özelleştir” → “Yönetim” → “Başlangıç düzeni yap”**. **“Yerleşik başlangıç düzenine dön”** bunu geri alır.

**Ayarlar → Modüller → Pano** bölümünde **“Kişisel panolar”** kapalıysa herkes başlangıç setini görür ve değiştiremez.`,
      steps: [
        'Panoyu herkesin görmesi gerektiği gibi düzenleyin.',
        '**“Özelleştir”** → **“Yönetim”**e tıklayın.',
        '**“Başlangıç düzeni yap”**ı seçin ve onaylayın.',
      ],
      example: {
        title: 'Yeni başlayanlar için pano',
        body: 'Yönetici “Karşılama”, “Hızlı erişim” ve “Bilgi bankası”nı üste, “Bildirimler” ve “Son dosyalar”ı alta yerleştirir ve bunu başlangıç seti yapar. Her yeni çalışan ilk günden doğru modülleri ve kılavuzları görür.',
      },
      note: 'Kendi panosu olan kişiler etkilenmez — “Sıfırla”ya tıklayana kadar.',
    },
    {
      title: 'Telefonda',
      body: `Dar ekranda pencere öğeleri bilgisayardakiyle aynı sırada **tek sütun** hâlinde dizilir. Telefonda genişlik değiştirilemez — düzenlemek büyük ekranda daha kolaydır.

Tüm cihazlarda tek bir panonuz vardır: bilgisayarda değiştirdiğiniz her şey telefonunuzda da olur.`,
    },
  ],
  faq: [
    {
      q: '“Özelleştir” düğmesi yok.',
      a: 'Yönetici **kişisel panoları** kapatmış — herkeste aynı başlangıç seti vardır.',
    },
    {
      q: 'Bir pencere öğesi neden galeride yok?',
      a: 'Modülü kapalıdır veya modüle erişiminiz yoktur. Örneğin “Kullanıcılar ve oturum açmalar” yalnızca kullanıcıları görüntüleme izni olanlar içindir.',
    },
    {
      q: 'İş arkadaşlarım panomu görür mü?',
      a: 'Hayır, pano kişiseldir. Ayrıca herkesin pencere öğeleri verileri kendi izinlerine göre gösterir.',
    },
    {
      q: 'Nasıl baştan başlarım?',
      a: '**“Özelleştir” → “Sıfırla”** başlangıç setini geri getirir. Pencere öğeleriniz ve ayarlarınız kaybolur.',
    },
    {
      q: '“Not”taki metin kaydediliyor mu?',
      a: 'Evet, not siz yazdıkça kaydedilir. Yalnızca siz görürsünüz.',
    },
    {
      q: 'Pano portalın adresinde açılabilir mi?',
      a: 'Evet, yönetici **Ayarlar → Site erişimi → Ana sayfa** bölümünde “Pano”yu seçerse.',
    },
  ],
  fields: {
    widgetTitle: {
      title: 'Başlık',
      text: 'Kart için kendi adınız. Boşsa — pencere öğesinin standart adı. Aynısından birkaç tane olduğunda kullanışlıdır.',
    },
    period: {
      title: 'Dönem',
      text: 'Rakamların ve grafiğin kapsadığı son gün sayısı.',
    },
    gallery: {
      title: 'Pencere öğesi galerisi',
      text: 'Yalnızca size açık pencere öğeleri listelenir. Aynı pencere öğesi farklı ayarlarla birkaç kez eklenebilir.',
    },
    personalize: {
      title: 'Kişisel panolar',
      text: 'Açık — herkes kendi panosunu oluşturur. Kapalı — herkes başlangıç setini görür ve değiştiremez.',
    },
  },
};
