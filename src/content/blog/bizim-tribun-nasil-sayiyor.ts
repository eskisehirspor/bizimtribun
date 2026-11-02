import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "bizim-tribun-nasil-sayiyor",
  title: "Bizim Tribün taraftarları nasıl sayıyor?",
  description:
    "Doğrulanmış hesap, tek ve kalıcı oy, il il dağılım: Bizim Tribün'ün taraftar sayımının kuralları ve bir anketten farkı.",
  publishedAt: "2026-11-02",
  status: "published",
  sources: [],
  body: `
"Hangi takımın kaç taraftarı var?" sorusunun cevabı genelde bir anketten gelir: birkaç bin kişiye sorulur, sonuç Türkiye nüfusuna oranlanır. Bizim Tribün başka bir yol seçti. Kimseye sormuyoruz; taraftarlar kendileri gelip sayılıyor. Bu yazıda bu sayımın kurallarını anlatıyoruz, çünkü bir sayının değeri ona nasıl ulaşıldığına bağlı.

## Kısaca kurallar

- Her taraftar **doğrulanmış bir hesapla** sayılır. Hesap, e-posta adresine gelen 6 haneli kodla açılır.
- Her hesap **yalnızca bir takıma, bir kez** oy verir. Oy sonradan değiştirilemez.
- Oy verirken ilini de seçersin. Böylece her takımın taraftarı **il il** sayılır.
- Sayaçlar yalnızca bu oylardan hesaplanır. Tahmin, ağırlıklandırma ya da nüfusa oranlama yoktur.

## Neden "tek ve kalıcı" oy?

Oy değiştirilebilseydi sayım bir anketten çok bir anlık kampanyaya dönüşürdü: bir derbi haftası, bir transfer haberi, organize bir çağrı tabloyu bir gecede değiştirebilirdi. Tek ve kalıcı oy, her satırın "bu kişi bu takımı tutuyor" anlamına gelmesini sağlar.

Bu kural yalnızca arayüzde değil, veritabanının kendisinde de korunuyor. Bir oy kaydı silinemez; takımı, ili ve oy zamanı sonradan değiştirilemez. Bunu veritabanı tetikleyicileri garanti eder; yönetim panelinden bile bir oyun takımı başka takıma taşınamaz.

## Sahte hesaplara karşı ne yapılıyor?

Hiçbir çevrim içi sayım sahte hesaplardan tamamen arınık değildir; bunu açıkça söylemek gerekiyor. Ama bir oyu "ucuz" olmaktan çıkaran birkaç katman var:

- **E-posta doğrulaması:** Kod gelmeyen adresle hesap açılmaz. Bir e-posta adresi en fazla bir hesapta doğrulanabilir; Gmail'deki nokta ve "+etiket" gibi aynı kutuya giden varyasyonlar aynı adres sayılır.
- **Geçici e-posta engeli:** Tek kullanımlık e-posta servislerinin bilinen alan adları kabul edilmez.
- **Cihaz sınırı:** Aynı tarayıcıdan en fazla 2 hesap açılabilir.
- **Hız sınırları ve bot kontrolü:** Kod istekleri ve üyelikler IP ve adres başına sınırlıdır; her kod isteğinden önce bir bot kontrolü yapılır.
- **Silinen hesabın oyu düşer:** Hesabını silen kişinin oyu geçersiz sayılır ve bütün sayaçlar bir azalır. Aynı adresin hemen geri dönüp tekrar oy vermesini önlemek için adresin kendisi değil, ondan geri çevrilemeyen bir özet bir süre tutulur.

## İller nasıl boyanıyor?

[Ana sayfadaki harita](/) her ili, o ilde en çok oy alan takımın renklerine boyar. İki takım eşitse il çizgili görünür ve "ortak lider" yazar; hiç oy yoksa gri kalır. Her ilin kendi sayfası da vardır; örneğin [Eskişehir'de hangi takımın önde olduğunu](/il/eskisehir) il sayfasından görebilirsin.

## "Açılış verisi" nedir?

Site yeni açıldığında harita bomboş görünmesin diye ana sayfadaki sayaçlara bir miktar **açılış verisi** eklendi. Bu sayılar gerçek oy değildir ve bunu sayfada açıkça yazıyoruz. Açılış verisi takım ve il sayfalarına, oy sayımına ya da arama motorlarının okuduğu metinlere hiçbir zaman girmez; tek bir ayarla tamamen kapatılabilir.

## Bir anketten farkı ne?

Anket ve sayım farklı soruları cevaplar:

| | Anket | Bizim Tribün sayımı |
|---|---|---|
| Kim sayılıyor? | Seçilmiş bir örneklem | Gelip oy veren herkes |
| Sonuç neyi gösterir? | Türkiye geneli için bir tahmin | Gerçekten sayılan kişi sayısı |
| Güçlü yanı | Nüfusu temsil etmeye çalışır | Her sayı bir kişiye karşılık gelir |
| Zayıf yanı | Örneklem hatası, soru biçimi | Katılan kitleye bağlıdır |

Yani Bizim Tribün'deki sayılar "Türkiye'nin yüzde kaçı hangi takımı tutuyor" sorusunun cevabı değil; "kaç taraftar gelip takımını sahiplendi" sorusunun cevabı. Takımının daha üstte olmasını istiyorsan yapılacak şey basit: taraftar arkadaşlarını çağır.

## Kendi verin sende

Oy verirken verdiğin bilgilerin nasıl işlendiğini [KVKK aydınlatma metninde](/kvkk) bulabilirsin. Hesabını ve verilerini istediğin zaman [buradan silebilirsin](/sil-verilerim).

[Takımını seç ve sayıma katıl →](/uye-ol)
`,
};
