import type { BlogPost } from "@/lib/blog";

export const post: BlogPost = {
  slug: "taraftar-anketleri-neden-farkli-sonuc-veriyor",
  title: "Taraftar anketleri neden farklı sonuç veriyor?",
  description:
    "Örneklem, hata payı, yüz yüze ya da internetten görüşme, sorunun dili ve zamanlama: taraftar anketlerinin birbirini tutmamasının sebepleri.",
  publishedAt: "2026-11-08",
  status: "published",
  sources: [
    {
      title: "En fazla taraftarı olan kulüp belli oldu (KONDA Hayat Tarzları Araştırması)",
      publisher: "Son Dakika",
      date: "19 Şubat 2025",
      url: "https://www.sondakika.com/spor/haber-en-fazla-taraftari-olan-kulup-belli-oldu-18391116/",
    },
    {
      title: "Hayat tarzı şifreleri (KONDA Hayat Tarzları 2024 yöntemi)",
      publisher: "Forbes Türkiye",
      date: "3 Ocak 2025",
      url: "https://www.forbes.com.tr/dergi/hayat-tarzi-sifreleri",
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
    {
      title: "Taraftar araştırması: 'Spor kulübü' denince akla Fenerbahçe geliyor, 'en beğenilen' takım Galatasaray",
      publisher: "Diken",
      date: "25 Nisan 2022",
      url: "https://www.diken.com.tr/?p=1114040",
    },
    {
      title: "Twentify taraftarlık araştırması: En çok taraftar Galatasaray'da",
      publisher: "Fanatik",
      date: "1 Eylül 2021",
      url: "https://www.fanatik.com.tr/twentify-taraftarlik-arastirmasi-en-cok-taraftar-galatasarayda-2239349",
    },
    {
      title: "Türkiye taraftarlık raporu açıklandı: Galatasaray 60 ilde birinci (Socios.com)",
      publisher: "Cumhuriyet",
      date: "20 Temmuz 2022",
      url: "https://www.cumhuriyet.com.tr/spor/turkiye-taraftarlik-raporu-aciklandi-galatasaray-60-ilde-birinci-1960081",
    },
    {
      title: "Tarihi sezonda şampiyon Galatasaray",
      publisher: "beIN Sports Türkiye",
      date: "26 Mayıs 2024",
      url: "https://beinsports.com.tr/haber/tarihi-sezonda-sampiyon-galatasaray",
    },
    {
      title: "Trabzonspor şampiyon: 38 yıl sonra gelen şampiyonluğun öyküsü",
      publisher: "Cumhuriyet",
      date: "1 Mayıs 2022",
      url: "https://www.cumhuriyet.com.tr/spor/trabzonspor-sampiyon-38-yil-sonra-gelen-sampiyonlugun-oykusu-1931560",
    },
  ],
  body: `
KONDA'nın Ekim 2024'te yaptığı araştırmada Galatasaray %36, Fenerbahçe %30 çıkıyor. YouGov'un dört ay önceki anketinde ise iki takım da "yaklaşık %30" ile başa baş. İki anketten biri yanlış mı? Büyük ihtimalle hayır. Anketler aynı soruyu sorar gibi görünse de aslında farklı kişilere, farklı yollarla, farklı kelimelerle ve farklı zamanlarda soruyor.

Anketlerin sonuçlarını yan yana gördüğümüz [önceki yazımızda](/blog/en-cok-taraftari-olan-takim) "ne çıktı" sorusuna baktık. Bu yazıda "neden farklı çıktı" sorusunun peşine düşüyoruz.

## Örneklem büyüklüğü ve hata payı

Bir anket bütün nüfusa değil, ondan seçilmiş bir gruba sorulur. Bu yüzden her sonuç bir aralıktır. Tamamen rastgele seçilmiş bir örneklemde, %95 güvenle hata payı kabaca şu formülle hesaplanır: **1,96 × √(p × (1 − p) / n)**. Burada *p* ölçülen oran, *n* görüşülen kişi sayısı.

Formülün söylediği basit: örneklem büyüdükçe hata payı küçülür, ama yavaş küçülür. Kişi sayısını dört katına çıkarmak hata payını ancak yarıya indirir.

Gazetelere yansıyan anketlerin örneklemlerine bu formülü uyguladık. Aşağıdaki hata payları anketlerin kendi açıklaması değil, %30'luk bir oran için bizim hesabımız:

| Anket | Görüşülen kişi | %30'luk bir oran için hata payı (yaklaşık) |
|---|---|---|
| YouGov, Haziran 2024 | 502 | ±4,0 puan |
| NG Araştırma, Ocak 2023 | 1.502 | ±2,3 puan |
| ANDY-AR, Mart 2016 | 2.145 | ±1,9 puan |
| KONDA, Ekim 2024 | 6.137 | ±1,1 puan |

İki uyarı var. Birincisi, bu hesap ideal bir rastgele örneklem varsayar. Gerçek anketlerde görüşmeler belli mahallelerde kümelenir ve sonuçlar ağırlıklandırılır; bu da gerçek hata payını büyütür. İkincisi, iki takım arasındaki *fark* tek bir orandan daha belirsizdir. 502 kişilik bir örneklemde iki takım da %30 civarındaysa, aradaki farkın hata payı aynı formülün mantığıyla ±6-7 puana çıkar. YouGov'un "başa baş" sonucu ile KONDA'nın 6 puanlık farkı bu yüzden birbiriyle çelişmek zorunda değil.

Haberlerde bu anketlerin hiçbiri için hata payı yayımlanmamış. Hata payı yazmayan bir anket haberini okurken bunu akılda tutmakta fayda var.

## Kime, nasıl soruldu?

Örneklemin kaç kişi olduğu kadar kimlerden oluştuğu da önemli:

| Anket | Yöntem | Kapsam |
|---|---|---|
| KONDA, Ekim 2024 | Hanelerde yüz yüze görüşme | 43 ilde 951 mahalle, 15 yaş üstü |
| NG Araştırma, 4-11 Ocak 2023 | Haberde belirtilmemiş | Türkiye geneli, 15 yaş üstü |
| ANDY-AR, Mart 2016 | Telefonla (CATI), yaş, eğitim ve mahalle kotalarıyla | 81 il |
| YouGov, 12-20 Haziran 2024 | İnternetten (CAWI) | Yalnızca 6 büyükşehir, 15 yaş üstü, ABC1C2 gelir grupları |

YouGov'un örneklemi İstanbul, Ankara, İzmir, Adana, Bursa ve Samsun'la sınırlı ve alt gelir grubunu kapsamıyor. Trabzonspor'un ya da başka Anadolu kulüplerinin güçlü olduğu iller bu ankete hiç girmiyor. İnternet anketleri ayrıca interneti daha çok kullanan, daha genç kesime kayabilir. Yüz yüze ve telefon görüşmesinde ise insanlar karşılarındaki kişiye cevap verir; ekranda tek başına cevap vermek bazen farklı sonuç doğurur.

## Soru nasıl soruldu?

"Hangi takımın taraftarısınız?" ile "Hangi takıma sempati duyuyorsunuz?" aynı soru değil. Bunu en iyi gösteren örnek, 2022'de bir çevrim içi bahis platformu adına 1.200 kişiyle yapılan bir anket. Aynı kişilere iki farklı soru sorulmuş:

- "Spor kulübü" denince akla ilk gelen takım: Fenerbahçe %32, Galatasaray %29, Beşiktaş %22, Trabzonspor %3.
- Süper Lig'de en beğenilen takım: Galatasaray %27, Fenerbahçe %25, Beşiktaş %21, Trabzonspor %12.

Aynı örneklemde sıralama yer değiştiriyor ve Trabzonspor'un oranı dört katına çıkıyor. Bunların ikisi de "kaç taraftarı var" sorusunun cevabı değil.

Sempati ayrı bir ölçüdür. ANDY-AR 2016'da katılımcılara kendi takımları dışında kime sempati duyduklarını da sormuş: ilk sırada %27,1 ile Beşiktaş çıkmış, kendi takımı dışında hiçbir takıma sempati duymayanlar %10,4'te kalmış. Yani "sempati" sorusuyla ölçülen bir takım, "tutuyorum" sorusundaki yerinden çok daha yukarıda görünebilir.

## "Takım tutmuyorum" diyenler nereye yazılıyor?

Bir anketin paydası da sonucu değiştirir. ANDY-AR 2016'da takım tutmayanların oranı %2,5; YouGov 2024'te %16, 15-24 yaş arasında ise %26. KONDA ve NG Araştırma haberlerinde bu oran hiç verilmemiş ve takım oranlarının toplamı %100 ediyor; büyük ihtimalle yalnızca takım tutanlar üzerinden hesaplanmış.

Fark küçük değil: takım tutmayanlar dahil edilen bir ankette her takımın oranı doğal olarak daha düşük çıkar.

## Zamanlama

Anketin ne zaman yapıldığı da sonucun bir parçası. YouGov'un saha çalışması 12-20 Haziran 2024'te, Galatasaray'ın 26 Mayıs 2024'te şampiyonluğu garantilemesinden birkaç hafta sonra yapıldı. Socios.com'un il il anketi ise Trabzonspor'un 38 yıl sonra şampiyon olduğu sezonda yapıldı ve Temmuz 2022'de yayımlandı.

Şampiyonluğun bir ankette kaç puanlık etki yarattığını ölçen yayımlanmış bir çalışma bulamadık. Ama takımla bağı zayıf olanların başarılı bir sezonun ardından "tutuyorum" demeye daha yatkın olabileceği makul bir ihtimal. Bu yüzden bir anketin tarihine, sezonun hangi anına denk geldiğine bakmak gerekiyor.

## Yüzdeden milyona

Bazı araştırmalar oranları nüfusa çevirip milyonlu sayılar verir. Örneğin Twentify, Ağustos 2021'de 18 yaş üstü 1.218 kişiyle yaptığı araştırmadan Galatasaray için 25,9 milyon, Fenerbahçe için 20,3 milyon, Beşiktaş için 13,5 milyon taraftar tahmini çıkarmış. Böyle bir sayı kesin görünür, ama yüzdedeki hata payı milyonlu sayıya da aynen taşınır. Sonuç tek bir sayı değil, bir aralıktır.

## Bizim Tribün bu tablonun neresinde?

Bizim Tribün bir anket değil, dolayısıyla temsili de değil. Burada kimse rastgele seçilmiyor; taraftarlar kendileri gelip oy veriyor. Bu, sayımın internet kullanan, sosyal medyada çağrıyı gören ve takımını sahiplenmeye istekli kesime kayabileceği anlamına geliyor. Bu yüzden Bizim Tribün'deki sayılar için bir hata payı hesaplamıyoruz ve onları Türkiye geneli bir orana çevirmiyoruz.

Buna karşılık her sayı, doğrulanmış bir hesabın verdiği tek ve kalıcı bir oya karşılık geliyor. Kuralların ayrıntısını [Bizim Tribün nasıl sayıyor?](/blog/bizim-tribun-nasil-sayiyor) yazısında anlattık. Güncel tabloya [takımlar sayfasından](/takimlar) ya da [ana sayfadaki haritadan](/) bakabilirsin.
`,
};
