import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "en-cok-taraftari-olan-takim",
  title: "Türkiye'de en çok taraftarı olan takım hangisi? Anketler ne diyor",
  description:
    "KONDA, NG Araştırma, YouGov ve ANDY-AR anketlerinde Galatasaray, Fenerbahçe, Beşiktaş ve Trabzonspor'un taraftar oranları, kaynaklarıyla.",
  publishedAt: "2026-11-02",
  status: "published",
  sources: [
    {
      title: "En fazla taraftarı olan kulüp belli oldu (KONDA Hayat Tarzları Araştırması)",
      publisher: "Son Dakika",
      date: "19 Şubat 2025",
      url: "https://www.sondakika.com/spor/haber-en-fazla-taraftari-olan-kulup-belli-oldu-18391116/",
    },
    {
      title: "Türkiye'de en çok hangi takımın taraftarı var? (NG Araştırma)",
      publisher: "Gerçek Hayat (gzt.com)",
      date: "17 Ocak 2023",
      url: "https://www.gzt.com/spor/turkiyede-en-cok-hangi-takimin-taraftari-var-3711014",
    },
    {
      title: "YouGov araştırması: futbol taraftarlığı",
      publisher: "Marketing Türkiye",
      date: "29 Haziran 2024",
      url: "https://www.marketingturkiye.com.tr/?p=158441",
    },
    {
      title: "Türkiye'nin en kapsamlı taraftar araştırması (ANDY-AR)",
      publisher: "Habertürk",
      date: "17 Mart 2016",
      url: "https://www.haberturk.com/turkiyenin-en-kapsamli-taraftar-arastirmasi-1210918",
    },
  ],
  body: `
Kısa cevap: Bu yazıda incelediğimiz 81 ili kapsayan anketlerin hepsinde **Galatasaray birinci, Fenerbahçe ikinci, Beşiktaş üçüncü** çıkıyor. Galatasaray ile Fenerbahçe arasındaki fark anketten ankete 2 ile 6 puan arasında değişiyor; yalnızca altı büyükşehirde yapılan bir ankette iki takım başa baş.

Uzun cevap için anketlerin neyi, kime ve nasıl sorduğuna bakmak gerekiyor.

## Anketler yan yana

| Anket | Galatasaray | Fenerbahçe | Beşiktaş | Trabzonspor |
|---|---|---|---|---|
| KONDA, Ekim 2024 | %36 | %30 | %20 | %4 |
| NG Araştırma, Ocak 2023 | %37 | %32 | %19 | %4 |
| YouGov, Haziran 2024 (6 büyükşehir) | ~%30 | ~%30 | %18 | – |
| ANDY-AR, Mart 2016 | %32,5 | %30,4 | %16,7 | %5 |
| KONDA, 2017 | %35 | %30 | %22 | %4 |

Tablodaki "–", kaynakta o takım için oran verilmediği anlamına geliyor. Kaynakların tamamı yazının sonunda.

## Anketler neden birbirini tutmuyor?

Rakamların yakın ama aynı olmamasının birkaç sebebi var:

- **Örneklem büyüklüğü.** KONDA'nın 2024 araştırması 6.137 kişiyle, NG Araştırma 1.502 kişiyle, YouGov 502 kişiyle yapılmış. Küçük örneklemde birkaç puanlık fark tesadüf olabilir.
- **Kime sorulduğu.** YouGov anketi yalnızca İstanbul, Ankara, İzmir, Adana, Bursa ve Samsun'da, internet üzerinden yapılmış. Anadolu kulüplerinin güçlü olduğu iller bu ankette yok.
- **Yöntem.** ANDY-AR 2016'da 81 ilde telefonla, yaş, eğitim ve mahalle kotalarıyla görüşmüş. YouGov çevrim içi anket kullanmış. Aynı soru telefonda ve ekranda farklı cevaplanabiliyor.
- **"Takım tutmuyorum" diyenler.** Bu oran ANDY-AR 2016'da %2,5, YouGov 2024'te %16; YouGov'a göre 15-24 yaş arasında %26'ya çıkıyor. KONDA ve NG Araştırma'nın haberlerinde bu oran verilmemiş; oranların toplamı %100 ettiği için büyük ihtimalle yalnızca bir takım tutanlar üzerinden hesaplanmış.

Son madde önemli: "Türkiye'nin yüzde 36'sı Galatasaraylı" ile "takım tutanların yüzde 36'sı Galatasaraylı" aynı cümle değil.

## Anadolu kulüpleri nerede?

Ulusal anketlerde dört büyüklerin dışında kalan bütün kulüpler genelde tek bir "diğer" satırında toplanıyor: KONDA'da %10, NG Araştırma'da %8. Kulüp kulüp döküm veren az sayıdaki ankete bir örnek ANDY-AR 2016: Bursaspor %2,4, Eskişehirspor %2, Konyaspor %1,8, Sivasspor %1,6, Kayserispor %1,3.

Bu, Anadolu kulüplerinin küçük olduğu anlamına gelmiyor; taraftarları kendi illerinde yoğunlaştığı için ülke geneli bir yüzde onları görünmez kılıyor. İl il bakınca tablo değişiyor; bunu [hangi ilde hangi takımın tutulduğunu anlatan yazımızda](/blog/hangi-ilde-hangi-takim-tutuluyor) ele aldık.

## Bizim Tribün'ün sayımı bunlardan nasıl ayrılıyor?

Anketler bir örneklemden Türkiye geneli için tahmin üretir. Bizim Tribün ise tahmin yapmaz: doğrulanmış her hesap bir takıma bir kez oy verir ve sayaç gerçekten kaç kişinin sayıldığını gösterir. Bu yüzden iki sayı farklı soruların cevabıdır; ayrıntısı [sayımın nasıl yapıldığını anlatan yazıda](/blog/bizim-tribun-nasil-sayiyor).

Takımların güncel sayısına bakmak için:

- [Galatasaray taraftar sayısı](/takim/galatasaray)
- [Fenerbahçe taraftar sayısı](/takim/fenerbahce)
- [Beşiktaş taraftar sayısı](/takim/besiktas)
- [Trabzonspor taraftar sayısı](/takim/trabzonspor)
- [Bütün takımlar](/takimlar)

Kendi takımının bu tabloda nerede durduğunu merak ediyorsan [sayıma katıl](/uye-ol).
`,
};
