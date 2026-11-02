import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "hangi-ilde-hangi-takim-tutuluyor",
  title: "Hangi ilde hangi takım tutuluyor? Anketlerdeki il haritası",
  description:
    "Galatasaray kaç ilde önde, Trabzon neden tek renk, Eskişehir ve Sivas kimi tutuyor? İl il taraftarlık anketleri ve sınırları, kaynaklarıyla.",
  publishedAt: "2026-11-02",
  status: "published",
  sources: [
    {
      title: "Türkiye taraftarlık raporu açıklandı: Galatasaray 60 ilde birinci (Socios.com Taraftarlık Anketi)",
      publisher: "Cumhuriyet",
      date: "20 Temmuz 2022",
      url: "https://www.cumhuriyet.com.tr/spor/turkiye-taraftarlik-raporu-aciklandi-galatasaray-60-ilde-birinci-1960081",
    },
    {
      title: "En çok taraftar kimde? (Bilyoner.com üye verisi)",
      publisher: "Dünya",
      date: "12 Mart 2012",
      url: "https://www.dunya.com/gundem/en-cok-taraftar-kimde-haberi-168033",
    },
  ],
  body: `
Ülke geneli anketlerde Anadolu kulüpleri birkaç puanlık bir "diğer" satırında kaybolur. İl il bakınca ise harita bambaşka görünür: bazı iller tek renktir, bazılarında yerel kulüp büyük takımlarla başa baş gider.

Bu yazıda il düzeyinde sonuç yayımlamış iki çalışmaya bakıyoruz. İkisinin de sınırları var; onları da yazının içinde açıkça belirtiyoruz.

## Socios.com anketi: 81 ilde 50 bine yakın katılımcı

Taraftar uygulaması Socios.com'un 2022'de yayımladığı ankete göre:

- **Galatasaray 60 ilde, Fenerbahçe 17 ilde** önde.
- **Beşiktaş yalnızca bir ilde**, Iğdır'da %36,54 ile birinci.
- Yerel kulübün lider olduğu iller: **Trabzon** (Trabzonspor), **Eskişehir** (Eskişehirspor) ve **Sivas** (Sivasspor).

İl düzeyinde verilen oranlar:

| İl | Önde olan takım | Oran |
|---|---|---|
| Trabzon | Trabzonspor | %87,7 |
| İstanbul | Galatasaray | %38,9 |
| Iğdır | Beşiktaş | %36,54 |
| Eskişehir | Eskişehirspor | %36,03 |
| Sivas | Sivasspor | %34,20 |
| İzmir | Fenerbahçe | %34,3 |

Haberde 81 ilin tam listesi yayımlanmadığı için diğer illerin oranlarını bilmiyoruz.

**Sınırı:** Bu anket rastgele seçilmiş bir örneklemle değil, uygulamanın kullanıcılarıyla yapıldı. Katılanlar ankete kendileri gelmiş futbolseverler; yani sonuçlar o kullanıcı kitlesini yansıtıyor, Türkiye nüfusunu değil.

## On yıl önce: Bilyoner.com üye verisi (2012)

İl düzeyinde döküm veren daha eski bir kaynak, bahis sitesi Bilyoner.com'un 2012'de üyelerinin tuttuğu takımlardan çıkardığı harita. Bu veride:

- Galatasaray 46 ilde, Fenerbahçe 32 ilde önde; Trabzonspor, Eskişehirspor ve Sivasspor kendi illerinde birinci.
- İstanbul'da Fenerbahçe %36, Galatasaray %35; Ankara'da Fenerbahçe %36, Galatasaray %33.
- Trabzon'da Trabzonspor %79; Eskişehir'de Eskişehirspor %30, Galatasaray %29; Sivas'ta Sivasspor %28, Fenerbahçe %27.
- Bursa'da Bursaspor %20 ile üçüncü.

**Sınırı:** Örneklem bahis sitesinin üyeleri ve örneklem büyüklüğü verilmemiş. Bu yüzden bu rakamları bugünü anlatmak için değil, yalnızca bir karşılaştırma noktası olarak okumak gerekiyor.

## İki veriden ne çıkıyor?

Yöntemleri farklı olsa da iki veri setinin ortak söylediği birkaç şey var:

- **Trabzon** iki çalışmada da açık ara tek renk.
- **Eskişehir** ve **Sivas** iki çalışmada da yerel kulübünü öne koyuyor, ama 2012'de büyük takımla fark yalnızca bir puan.
- İstanbul ve Ankara gibi büyükşehirlerde Galatasaray ile Fenerbahçe arasındaki sıralama veriden veriye değişiyor.

İkisinin ortak bir eksiği de var: Hiçbiri il il tam tabloyu yayımlamıyor ve ikisi de ankete kendi gelen bir kitleye dayanıyor.

## Bizim Tribün haritası

[Ana sayfadaki Türkiye haritası](/) her ili, Bizim Tribün'de o ilden oy veren taraftarların en çok tuttuğu takımın renklerine boyar. Bu da bir anket değil, bir sayım: her il sayfası orada kaç doğrulanmış taraftarın hangi takımı seçtiğini gösterir. Nasıl sayıldığını [şu yazıda](/blog/bizim-tribun-nasil-sayiyor) anlattık.

Yazıda geçen illerin sayfaları:

- [Trabzon](/il/trabzon) · [İstanbul](/il/istanbul) · [Iğdır](/il/igdir)
- [Eskişehir](/il/eskisehir) · [Sivas](/il/sivas) · [İzmir](/il/izmir)

İlin haritada hangi renge boyanacak? [Takımını seç, ilini işaretle](/uye-ol).
`,
};
