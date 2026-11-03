import type { BlogSource } from "@/lib/blog";

/**
 * Sourced numbers from outside Bizim Tribün, shown on team and province pages
 * next to the live count. Every figure here is also cited in a blog post (the
 * research was done there); a new figure needs a source someone has read.
 */

export type FanFact = {
  label: string;
  value: string;
  /** Short context: the season, sample or what the figure does not say. */
  note?: string;
  source: BlogSource;
};

export type FactSheet = {
  facts: FanFact[];
  /** Blog slugs to read next; links to posts that are not live yet are dropped. */
  posts: string[];
};

const SRC = {
  konda: {
    title: "En fazla taraftarı olan kulüp belli oldu (KONDA Hayat Tarzları Araştırması)",
    publisher: "Son Dakika",
    date: "19 Şubat 2025",
    url: "https://www.sondakika.com/spor/haber-en-fazla-taraftari-olan-kulup-belli-oldu-18391116/",
  },
  ng: {
    title: "Türkiye'de en çok hangi takımın taraftarı var? (NG Araştırma)",
    publisher: "Gerçek Hayat (gzt.com)",
    date: "17 Ocak 2023",
    url: "https://www.gzt.com/spor/turkiyede-en-cok-hangi-takimin-taraftari-var-3711014",
  },
  andy: {
    title: "Türkiye'nin en kapsamlı taraftar araştırması (ANDY-AR)",
    publisher: "Habertürk",
    date: "17 Mart 2016",
    url: "https://www.haberturk.com/turkiyenin-en-kapsamli-taraftar-arastirmasi-1210918",
  },
  socios: {
    title: "Türkiye taraftarlık raporu açıklandı: Galatasaray 60 ilde birinci (Socios.com Taraftarlık Anketi)",
    publisher: "Cumhuriyet",
    date: "20 Temmuz 2022",
    url: "https://www.cumhuriyet.com.tr/spor/turkiye-taraftarlik-raporu-aciklandi-galatasaray-60-ilde-birinci-1960081",
  },
  bilyoner: {
    title: "En çok taraftar kimde? (Bilyoner.com üye verisi)",
    publisher: "Dünya",
    date: "12 Mart 2012",
    url: "https://www.dunya.com/gundem/en-cok-taraftar-kimde-haberi-168033",
  },
  attendance2526: {
    title: "İşte Süper Lig'de sezonun seyirci sayıları",
    publisher: "Ajansspor",
    date: "27 Mayıs 2026",
    url: "https://ajansspor.com/haber/iste-super-ligde-sezonun-seyirci-sayilari-726290",
  },
  attendance2627: {
    title: "Göztepe tribünde 9. sırada: İlk 6 haftanın seyirci ortalamaları açıklandı",
    publisher: "İz Gazete",
    date: "25 Eylül 2026",
    url: "https://www.izgazete.net/goztepe-tribunde-9-sirada-ilk-6-haftanin-seyirci-ortalamalari-aciklandi",
  },
  stadiums2627: {
    title: "Süper Lig 2026-2027 sezonu stat kapasiteleri açıklandı (TFF verisi, AA)",
    publisher: "Son Dakika",
    date: "11 Ağustos 2026",
    url: "https://www.sondakika.com/spor/haber-super-lig-69-sezon-statlari-hazir-20134942/",
  },
  passolig2019: {
    title: "Süper Lig'in seyirci ortalaması ne? Passolig rekoru hangi takıma ait?",
    publisher: "Goal Türkiye",
    date: "26 Mart 2019",
    url: "https://www.goal.com/tr/haber/sueper-ligin-seyirci-ortalamasi-ne-passolig-rekoru-hangi-takima-ait/1inq1kn0y4vmg1eol66p8pqb7l",
  },
  passolig2017: {
    title: "Passolig kartlı taraftar sayısı yüzde 30 arttı",
    publisher: "Anadolu Ajansı",
    date: "30 Kasım 2017",
    url: "https://www.aa.com.tr/tr/spor/passolig-kartli-taraftar-sayisi-yuzde-30-artti/986003",
  },
  passoligKocaeli: {
    title: "Kocaelispor'da Passolig kartı hedefi 100 bin (İHA)",
    publisher: "Fanatik",
    date: "23 Ekim 2025",
    url: "https://www.fanatik.com.tr/kocaelispor/kocaelisporda-passolig-karti-hedefi-100-bin-2598514",
  },
  bursaSeason: {
    title: "Süper Lig devlerini solda sıfır bıraktılar, bu sezon Türk futbol tarihine geçtiler",
    publisher: "Sözcü (DHA)",
    date: "23 Nisan 2026",
    url: "https://www.sozcu.com.tr/super-lig-devlerini-solda-sifir-biraktilar-bu-sezon-turk-futbol-tarihine-gectiler-p313863",
  },
  bursaIgdir: {
    title: "Bursaspor yine rekor kırdı! 9 maçın toplamından bile fazla çıktı",
    publisher: "Gazete Vatan",
    date: "19 Ağustos 2026",
    url: "https://www.gazetevatan.com/sehirler/bursa/bursaspor-yine-rekor-kirdi-9-macin-toplamindan-bile-fazla-cikti-2399079",
  },
  eskisehirRecord: {
    title: "Bölgesel Amatör Lig'de rekor: Eskişehirspor'un maçını 33 bin 247 taraftar izledi",
    publisher: "Diken",
    date: "27 Nisan 2025",
    url: "https://www.diken.com.tr/?p=1570079",
  },
} satisfies Record<string, BlogSource>;

const POST = {
  enCok: "en-cok-taraftari-olan-takim",
  ilIl: "hangi-ilde-hangi-takim-tutuluyor",
  seyirci: "super-lig-seyirci-ortalamalari",
  stadyum: "super-lig-stadyumlari-ve-kapasiteleri",
  trabzonspor: "trabzonspor-taraftar-sayisi",
  anadolu: "anadolu-kulupleri-taraftar-sayisi",
  eskisehirspor: "eskisehirspor-taraftari",
  anketler: "taraftar-anketleri-neden-farkli-sonuc-veriyor",
  passolig: "passolig-kart-sayisi",
};

const pct = (v: string) => `%${v}`;

// 2026-27 Süper Lig: stadium (TFF list) and average for the first 6 weeks.
const SUPER_2627: Record<string, { stadium: string; capacity: string; avg: string }> = {
  galatasaray: { stadium: "RAMS Park", capacity: "53.387", avg: "43.074" },
  fenerbahce: { stadium: "Chobani Stadı", capacity: "47.911", avg: "41.980" },
  besiktas: { stadium: "Tüpraş Stadı", capacity: "42.684", avg: "34.915" },
  konyaspor: { stadium: "MEDAŞ Konya Büyükşehir Stadı", capacity: "41.135", avg: "11.020" },
  trabzonspor: { stadium: "Papara Park", capacity: "41.061", avg: "35.862" },
  kocaelispor: { stadium: "Kocaeli Stadı", capacity: "34.829", avg: "16.601" },
  samsunspor: { stadium: "Samsun Yeni 19 Mayıs Stadı", capacity: "34.346", avg: "11.535" },
  "amed-sfk": { stadium: "Diyarbakır Stadı", capacity: "30.480", avg: "29.481" },
  "gaziantep-fk": { stadium: "Gaziantep Stadı", capacity: "30.320", avg: "6.582" },
  goztepe: { stadium: "ISONEM Park Gürsel Aksel Stadı", capacity: "23.376", avg: "14.408" },
  "erzurumspor-fk": { stadium: "Kazım Karabekir Stadı", capacity: "21.374", avg: "15.760" },
  genclerbirligi: { stadium: "Eryaman Stadı", capacity: "20.000", avg: "15.368" },
  "istanbul-basaksehir": { stadium: "Başakşehir Fatih Terim Stadı", capacity: "17.067", avg: "4.082" },
  "caykur-rizespor": { stadium: "Çaykur Didi Stadı", capacity: "14.879", avg: "7.757" },
  kasimpasa: { stadium: "Recep Tayyip Erdoğan Stadı", capacity: "13.797", avg: "4.191" },
  "corum-fk": { stadium: "Çorum Şehir Stadı", capacity: "13.119", avg: "6.160" },
  alanyaspor: { stadium: "Alanya Oba Stadı", capacity: "9.785", avg: "6.291" },
  eyupspor: { stadium: "Esenyurt Necmi Kadıoğlu Stadı", capacity: "4.274", avg: "1.059" },
};

// 2025-26 Süper Lig season: average per home match and occupancy.
const SUPER_2526: Record<string, { avg: string; occupancy: string }> = {
  galatasaray: { avg: "41.661", occupancy: "77,18" },
  fenerbahce: { avg: "33.934", occupancy: "71,55" },
  besiktas: { avg: "28.163", occupancy: "65,98" },
  trabzonspor: { avg: "26.991", occupancy: "65,83" },
  kocaelispor: { avg: "19.189", occupancy: "55,09" },
  goztepe: { avg: "18.363", occupancy: "78,55" },
  konyaspor: { avg: "12.376", occupancy: "29,75" },
  samsunspor: { avg: "11.111", occupancy: "32,39" },
  "gaziantep-fk": { avg: "10.926", occupancy: "36,04" },
  genclerbirligi: { avg: "10.072", occupancy: "50,36" },
  kayserispor: { avg: "10.057", occupancy: "31,57" },
  antalyaspor: { avg: "7.676", occupancy: "26,19" },
  "caykur-rizespor": { avg: "5.984", occupancy: "40,22" },
  alanyaspor: { avg: "4.310", occupancy: "44,31" },
  "istanbul-basaksehir": { avg: "4.174", occupancy: "24,46" },
  eyupspor: { avg: "3.860", occupancy: "27,98" },
  kasimpasa: { avg: "2.283", occupancy: "16,55" },
  "fatih-karagumruk": { avg: "1.686", occupancy: "2,17" },
};

// Club-specific survey, Passolig and record figures.
const EXTRA: Record<string, FactSheet> = {
  galatasaray: {
    facts: [
      { label: "KONDA anketi", value: pct("36"), note: "Ekim 2024, 6.137 kişi; listede birinci", source: SRC.konda },
      { label: "NG Araştırma anketi", value: pct("37"), note: "Ocak 2023, 1.502 kişi", source: SRC.ng },
      { label: "Önde olduğu il sayısı", value: "60", note: "Socios.com il anketi, 2022", source: SRC.socios },
      { label: "Passolig kartı", value: "875.765", note: "Mart 2019; kulüp kulüp yayımlanan son resmi veri", source: SRC.passolig2019 },
    ],
    posts: [POST.enCok, POST.passolig],
  },
  fenerbahce: {
    facts: [
      { label: "KONDA anketi", value: pct("30"), note: "Ekim 2024, 6.137 kişi; listede ikinci", source: SRC.konda },
      { label: "NG Araştırma anketi", value: pct("32"), note: "Ocak 2023, 1.502 kişi", source: SRC.ng },
      { label: "Önde olduğu il sayısı", value: "17", note: "Socios.com il anketi, 2022", source: SRC.socios },
      { label: "Passolig kartı", value: "819.498", note: "Mart 2019", source: SRC.passolig2019 },
    ],
    posts: [POST.enCok, POST.passolig],
  },
  besiktas: {
    facts: [
      { label: "KONDA anketi", value: pct("20"), note: "Ekim 2024, 6.137 kişi; listede üçüncü", source: SRC.konda },
      { label: "NG Araştırma anketi", value: pct("19"), note: "Ocak 2023, 1.502 kişi", source: SRC.ng },
      { label: "Iğdır'daki oranı", value: pct("36,54"), note: "Socios.com 2022; önde olduğu tek il", source: SRC.socios },
      { label: "Passolig kartı", value: "722.451", note: "Mart 2019", source: SRC.passolig2019 },
    ],
    posts: [POST.enCok, POST.passolig],
  },
  trabzonspor: {
    facts: [
      { label: "KONDA anketi", value: pct("4"), note: "Ekim 2024; dört büyüklerin dördüncüsü", source: SRC.konda },
      { label: "Trabzon'daki oranı", value: pct("87,7"), note: "Socios.com 2022; ankette kendi ilinde en yüksek oran", source: SRC.socios },
      { label: "Passolig kartı", value: "257.204", note: "Mart 2019", source: SRC.passolig2019 },
    ],
    posts: [POST.trabzonspor, POST.enCok],
  },
  bursaspor: {
    facts: [
      { label: "ANDY-AR anketi", value: pct("2,4"), note: "Mart 2016; dört büyükler dışında en yüksek oran", source: SRC.andy },
      { label: "2025-26 iç saha ortalaması", value: "42 bin civarı", note: "2. Lig; şampiyonluk maçında 45.450 kişi", source: SRC.bursaSeason },
      { label: "Iğdır FK maçı seyircisi", value: "40.850", note: "1. Lig 2. hafta, Ağustos 2026", source: SRC.bursaIgdir },
      { label: "Passolig kartı", value: "116.840", note: "Kasım 2017", source: SRC.passolig2017 },
    ],
    posts: [POST.anadolu],
  },
  eskisehirspor: {
    facts: [
      { label: "Eskişehir'deki oranı", value: pct("36,03"), note: "Socios.com 2022; ilde birinci", source: SRC.socios },
      { label: "ANDY-AR anketi", value: pct("2"), note: "Mart 2016, Türkiye geneli", source: SRC.andy },
      { label: "Amatör lig seyirci rekoru", value: "33.247", note: "Akşehirspor maçı, 27 Nisan 2025", source: SRC.eskisehirRecord },
    ],
    posts: [POST.eskisehirspor, POST.anadolu],
  },
  sivasspor: {
    facts: [
      { label: "Sivas'taki oranı", value: pct("34,20"), note: "Socios.com 2022; ilde birinci", source: SRC.socios },
      { label: "ANDY-AR anketi", value: pct("1,6"), note: "Mart 2016, Türkiye geneli", source: SRC.andy },
    ],
    posts: [POST.anadolu],
  },
  konyaspor: {
    facts: [
      { label: "ANDY-AR anketi", value: pct("1,8"), note: "Mart 2016, Türkiye geneli", source: SRC.andy },
      { label: "Passolig kartı", value: "120.260", note: "Kasım 2017", source: SRC.passolig2017 },
    ],
    posts: [POST.anadolu],
  },
  kayserispor: {
    facts: [{ label: "ANDY-AR anketi", value: pct("1,3"), note: "Mart 2016, Türkiye geneli", source: SRC.andy }],
    posts: [POST.anadolu],
  },
  kocaelispor: {
    facts: [{ label: "Passolig kartı", value: "89.585", note: "Ekim 2025", source: SRC.passoligKocaeli }],
    posts: [POST.anadolu],
  },
  goztepe: { facts: [], posts: [POST.anadolu] },
  samsunspor: { facts: [], posts: [POST.anadolu] },
};

export function teamFacts(teamId: string): FactSheet {
  const facts: FanFact[] = [...(EXTRA[teamId]?.facts ?? [])];
  const posts = [...(EXTRA[teamId]?.posts ?? [])];
  const now = SUPER_2627[teamId];
  if (now) {
    facts.push(
      { label: "Stadı", value: now.capacity, note: `${now.stadium}, 2026-27 kapasitesi`, source: SRC.stadiums2627 },
      { label: "2026-27 seyirci ortalaması", value: now.avg, note: "Süper Lig, ilk 6 hafta", source: SRC.attendance2627 },
    );
  }
  const last = SUPER_2526[teamId];
  if (last) {
    facts.push({
      label: "2025-26 seyirci ortalaması",
      value: last.avg,
      note: `Süper Lig, sezon geneli; doluluk %${last.occupancy}`,
      source: SRC.attendance2526,
    });
  }
  if (now || last) posts.push(POST.seyirci);
  if (now) posts.push(POST.stadyum);
  return { facts, posts: [...new Set(posts)] };
}

// Province surveys: Socios.com (2022, nearly 50,000 people) and Bilyoner.com members (2012).
const CITY: Record<string, FanFact[]> = {
  Trabzon: [
    { label: "Trabzonspor", value: pct("87,7"), note: "Socios.com 2022; ankette en yüksek il-takım oranı", source: SRC.socios },
    { label: "Trabzonspor", value: pct("79"), note: "Bilyoner üyeleri, 2012; Galatasaray %8, Fenerbahçe %6", source: SRC.bilyoner },
  ],
  İstanbul: [{ label: "Galatasaray", value: pct("38,9"), note: "Socios.com 2022; ilde birinci", source: SRC.socios }],
  Iğdır: [{ label: "Beşiktaş", value: pct("36,54"), note: "Socios.com 2022; Beşiktaş'ın önde olduğu tek il", source: SRC.socios }],
  Eskişehir: [
    { label: "Eskişehirspor", value: pct("36,03"), note: "Socios.com 2022; ilde birinci", source: SRC.socios },
    { label: "Eskişehirspor", value: pct("30"), note: "Bilyoner üyeleri, 2012; Galatasaray %29, Fenerbahçe %20", source: SRC.bilyoner },
  ],
  Sivas: [
    { label: "Sivasspor", value: pct("34,20"), note: "Socios.com 2022; ilde birinci", source: SRC.socios },
    { label: "Sivasspor", value: pct("28"), note: "Bilyoner üyeleri, 2012; Fenerbahçe %27", source: SRC.bilyoner },
  ],
  İzmir: [{ label: "Fenerbahçe", value: pct("34,3"), note: "Socios.com 2022; ilde birinci", source: SRC.socios }],
  Bursa: [{ label: "Bursaspor", value: pct("20"), note: "Bilyoner üyeleri, 2012; ilde üçüncü", source: SRC.bilyoner }],
};

export function cityFacts(province: string): FactSheet {
  return { facts: CITY[province] ?? [], posts: [POST.ilIl] };
}

/** Nationwide context every province page can carry, from the same sources. */
export const NATIONAL_CONTEXT: FanFact[] = [
  { label: "Galatasaray'ın önde olduğu il", value: "60", note: "Socios.com il anketi, 2022", source: SRC.socios },
  { label: "Fenerbahçe'nin önde olduğu il", value: "17", note: "Socios.com il anketi, 2022", source: SRC.socios },
  { label: "Türkiye geneli birinci", value: "Galatasaray %36", note: "KONDA, Ekim 2024; Fenerbahçe %30, Beşiktaş %20", source: SRC.konda },
];

/** One line for "Türkiye'de en çok taraftarı olan takım hangisi?", from the national surveys. */
export const SURVEY_LEADER_ANSWER =
  "Ulusal anketlerde Galatasaray birinci: KONDA'nın Ekim 2024 araştırmasında %36, NG Araştırma'nın Ocak 2023 araştırmasında %37. Fenerbahçe iki ankette de ikinci, Beşiktaş üçüncü.";

/** Every team id and province the sheets above mention, for the tests. */
export function factKeys() {
  return {
    teams: [...new Set([...Object.keys(EXTRA), ...Object.keys(SUPER_2627), ...Object.keys(SUPER_2526)])],
    provinces: Object.keys(CITY),
  };
}
