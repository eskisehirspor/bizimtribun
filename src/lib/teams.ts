export type LeagueId = "super" | "lig1" | "lig2" | "lig3" | "bal";

export type Team = {
  id: string;
  name: string;
  short: string;
  city: string;
  league: LeagueId;
  bleed: string;
  accent: string;
  paper: string;
  ink: string;
};

export const LEAGUE_LABEL: Record<LeagueId, string> = {
  super: "Süper Lig",
  lig1: "1. Lig",
  lig2: "2. Lig",
  lig3: "3. Lig",
  bal: "Bölgesel Amatör Lig",
};

export const LEAGUE_ORDER: LeagueId[] = ["super", "lig1", "lig2", "lig3", "bal"];

const PAPER: Record<LeagueId, string> = {
  super: "#FFF4C2",
  lig1: "#E7F3E4",
  lig2: "#E4EEF8",
  lig3: "#F4EDE3",
  bal: "#EDE6DA",
};

type Row = [id: string, name: string, city: string, league: LeagueId, bleed: string];

const RAW: Row[] = [
  ["galatasaray", "Galatasaray", "İstanbul", "super", "#C8102E"],
  ["fenerbahce", "Fenerbahçe", "İstanbul", "super", "#001B48"],
  ["besiktas", "Beşiktaş", "İstanbul", "super", "#111111"],
  ["trabzonspor", "Trabzonspor", "Trabzon", "super", "#A00000"],
  ["istanbul-basaksehir", "İstanbul Başakşehir", "İstanbul", "super", "#F5A623"],
  ["goztepe", "Göztepe", "İzmir", "super", "#C8102E"],
  ["samsunspor", "Samsunspor", "Samsun", "super", "#C8102E"],
  ["caykur-rizespor", "Çaykur Rizespor", "Rize", "super", "#003DA5"],
  ["konyaspor", "Konyaspor", "Konya", "super", "#1B7A3A"],
  ["alanyaspor", "Alanyaspor", "Antalya", "super", "#F5A623"],
  ["kasimpasa", "Kasımpaşa", "İstanbul", "super", "#1B4D8C"],
  ["gaziantep-fk", "Gaziantep FK", "Gaziantep", "super", "#C8102E"],
  ["genclerbirligi", "Gençlerbirliği", "Ankara", "super", "#C8102E"],
  ["kayserispor", "Kayserispor", "Kayseri", "lig1", "#C8102E"],
  ["kocaelispor", "Kocaelispor", "Kocaeli", "super", "#1B7A3A"],
  ["antalyaspor", "Antalyaspor", "Antalya", "lig1", "#C8102E"],
  ["eyupspor", "Eyüpspor", "İstanbul", "super", "#C4A35A"],
  ["fatih-karagumruk", "Fatih Karagümrük", "İstanbul", "lig1", "#C8102E"],

  ["adana-demirspor", "Adana Demirspor", "Adana", "lig2", "#003087"],
  ["amed-sfk", "Amed SFK", "Diyarbakır", "super", "#1B7A3A"],
  ["bandirmaspor", "Bandırmaspor", "Balıkesir", "lig1", "#C8102E"],
  ["bodrum-fk", "Bodrum FK", "Muğla", "lig1", "#0077B6"],
  ["boluspor", "Boluspor", "Bolu", "lig1", "#C8102E"],
  ["corum-fk", "Çorum FK", "Çorum", "super", "#C8102E"],
  ["erzurumspor-fk", "Erzurumspor FK", "Erzurum", "super", "#0057B8"],
  ["esenler-erokspor", "Esenler Erokspor", "İstanbul", "lig1", "#C8102E"],
  ["hatayspor", "Hatayspor", "Hatay", "lig2", "#C8102E"],
  ["igdir-fk", "Iğdır FK", "Iğdır", "lig1", "#1B7A3A"],
  ["istanbulspor", "İstanbulspor", "İstanbul", "lig1", "#C4A35A"],
  ["keciorengucu", "Ankara Keçiörengücü", "Ankara", "lig1", "#4B2E83"],
  ["manisa-fk", "Manisa FK", "Manisa", "lig1", "#1B4D8C"],
  ["pendikspor", "Pendikspor", "İstanbul", "lig1", "#C8102E"],
  ["sakaryaspor", "Sakaryaspor", "Sakarya", "lig2", "#1B7A3A"],
  ["sariyer", "Sarıyer", "İstanbul", "lig1", "#1B4D8C"],
  ["serikspor", "Serikspor", "Antalya", "lig2", "#C8102E"],
  ["sivasspor", "Sivasspor", "Sivas", "lig1", "#C8102E"],
  ["umraniyespor", "Ümraniyespor", "İstanbul", "lig1", "#C8102E"],
  ["vanspor-fk", "Vanspor FK", "Van", "lig1", "#C8102E"],

  ["batman-petrolspor", "Batman Petrolspor", "Batman", "lig1", "#C8102E"],
  ["muglaspor", "Muğlaspor", "Muğla", "lig1", "#1B7A3A"],
  ["elazigspor", "Elazığspor", "Elazığ", "lig2", "#8B1A1A"],
  ["adana-01", "Adana 01 FK", "Adana", "lig2", "#F5A623"],
  ["sanliurfaspor", "Şanlıurfaspor", "Şanlıurfa", "lig2", "#1B7A3A"],
  ["mke-ankaragucu", "MKE Ankaragücü", "Ankara", "lig2", "#C4A35A"],
  ["inegolspor", "İnegölspor", "Bursa", "lig2", "#4B2E83"],
  ["iskenderunspor", "İskenderunspor", "Hatay", "lig2", "#F5A623"],
  ["beyoglu-yeni-carsi", "Beyoğlu Yeni Çarşı", "İstanbul", "lig2", "#1B4D8C"],
  ["ankaraspor", "Ankaraspor", "Ankara", "lig2", "#1B4D8C"],
  ["24-erzincanspor", "24 Erzincanspor", "Erzincan", "lig2", "#C8102E"],
  ["kastamonuspor", "Kastamonuspor", "Kastamonu", "lig2", "#C8102E"],
  ["karacabey-belediyespor", "Karacabey Belediyespor", "Bursa", "lig2", "#1B7A3A"],
  ["altinordu", "Altınordu", "İzmir", "lig2", "#C8102E"],
  ["erbaaspor", "Erbaaspor", "Tokat", "lig2", "#1B4D8C"],
  ["beykoz-anadoluspor", "Beykoz Anadoluspor", "İstanbul", "lig3", "#1B7A3A"],
  ["kepezspor", "Kepezspor", "Antalya", "lig3", "#C8102E"],
  ["karaman-fk", "Karaman FK", "Karaman", "lig3", "#1B4D8C"],
  ["bucaspor-1928", "Bucaspor 1928", "İzmir", "lig3", "#C8102E"],
  ["bursaspor", "Bursaspor", "Bursa", "lig1", "#0A7A2D"],
  ["mardin-1969", "Mardin 1969", "Mardin", "lig1", "#C8102E"],
  ["musspor", "Muşspor", "Muş", "lig2", "#1B4D8C"],
  ["aliaga-fk", "Aliağa FK", "İzmir", "lig2", "#F5A623"],
  ["kahramanmaras-istiklalspor", "Kahramanmaraş İstiklalspor", "Kahramanmaraş", "lig2", "#C8102E"],
  ["isparta-32", "Isparta 32", "Isparta", "lig2", "#1B7A3A"],
  ["guzide-gebzespor", "Güzide Gebzespor", "Kocaeli", "lig2", "#C8102E"],
  ["menemen-fk", "Menemen FK", "İzmir", "lig2", "#1B7A3A"],
  ["ankara-demirspor", "Ankara Demirspor", "Ankara", "lig2", "#1B4D8C"],
  ["68-aksaray", "68 Aksaray Belediyespor", "Aksaray", "lig2", "#C8102E"],
  ["1461-trabzon", "1461 Trabzon FK", "Trabzon", "lig2", "#8B1A1A"],
  ["arnavutkoy-belediyespor", "Arnavutköy Belediyespor", "İstanbul", "lig2", "#1B7A3A"],
  ["fethiyespor", "Fethiyespor", "Muğla", "lig2", "#1B4D8C"],
  ["kirklarelispor", "Kırklarelispor", "Kırklareli", "lig2", "#1B7A3A"],
  ["somaspor", "Somaspor", "Manisa", "lig2", "#C8102E"],
  ["yeni-mersin-idmanyurdu", "Yeni Mersin İdmanyurdu", "Mersin", "lig3", "#E85D04"],
  ["adanaspor", "Adanaspor", "Adana", "lig3", "#F5A623"],
  ["yeni-malatyaspor", "Yeni Malatyaspor", "Malatya", "lig3", "#C4A35A"],

  ["inegol-kafkasspor", "İnegöl Kafkasspor", "Bursa", "lig2", "#4B2E83"],
  ["corluspor-1947", "Çorluspor 1947", "Tekirdağ", "lig2", "#C8102E"],
  ["kucukcekmece-sinopspor", "Küçükçekmece Sinopspor", "İstanbul", "lig3", "#1B4D8C"],
  ["etimesgutspor", "Etimesgutspor", "Ankara", "lig3", "#C8102E"],
  ["bursa-yildirimspor", "Bursa Yıldırımspor", "Bursa", "lig3", "#1B7A3A"],
  ["silivrispor", "Silivrispor", "İstanbul", "lig3", "#1B4D8C"],
  ["beykoz-ishakli", "Beykoz İshaklı", "İstanbul", "lig3", "#C8102E"],
  ["bursa-nilufer", "Bursa Nilüfer", "Bursa", "lig3", "#1B7A3A"],
  ["yalova-fk-77", "Yalova FK 77", "Yalova", "lig3", "#C8102E"],
  ["galata", "Galata", "İstanbul", "lig3", "#C4A35A"],
  ["bulvarspor", "Bulvarspor", "İstanbul", "lig3", "#1B4D8C"],
  ["inkilap", "İnkılap", "İstanbul", "lig3", "#C8102E"],
  ["cankayaspor", "Çankayaspor", "Ankara", "bal", "#C8102E"],
  ["kestel-cilekspor", "Kestel Çilekspor", "Bursa", "bal", "#C8102E"],
  ["polatli-1926", "Polatlı 1926", "Ankara", "bal", "#1B7A3A"],
  ["edirnespor", "Edirnespor", "Edirne", "bal", "#8B1A1A"],
  ["12-bingolspor", "12 Bingölspor", "Bingöl", "lig2", "#1B7A3A"],
  ["erciyes-38", "Erciyes 38", "Kayseri", "lig3", "#C8102E"],
  ["silifke-belediyespor", "Silifke Belediyespor", "Mersin", "lig3", "#1B4D8C"],
  ["malatya-yesilyurtspor", "Malatya Yeşilyurtspor", "Malatya", "lig3", "#1B7A3A"],
  ["mazidagi-fosfatspor", "Mazıdağı Fosfatspor", "Mardin", "lig3", "#C8102E"],
  ["agri-1970", "Ağrı 1970", "Ağrı", "lig3", "#1B4D8C"],
  ["karakopru-belediyespor", "Karaköprü Belediyespor", "Şanlıurfa", "lig3", "#1B7A3A"],
  ["osmaniyespor", "Osmaniyespor", "Osmaniye", "lig3", "#C8102E"],
  ["nigde-belediyesispor", "Niğde Belediyesispor", "Niğde", "lig3", "#C8102E"],
  ["kirikkale", "Kırıkkale FK", "Kırıkkale", "lig3", "#1B4D8C"],
  ["kirsehir", "Kırşehir FK", "Kırşehir", "lig3", "#C8102E"],
  ["diyarbekirspor", "Diyarbekirspor", "Diyarbakır", "lig3", "#1B7A3A"],
  ["kahramanmarasspor", "Kahramanmaraşspor", "Kahramanmaraş", "bal", "#C8102E"],
  ["kilis-1984", "Kilis 1984", "Kilis", "bal", "#1B4D8C"],
  ["suvermez-kapadokyaspor", "Suvermez Kapadokyaspor", "Nevşehir", "bal", "#C4A35A"],
  ["turk-metal-1963", "Türk Metal 1963", "Kırıkkale", "bal", "#C8102E"],
  ["sebat-genclikspor", "Sebat Gençlikspor", "Trabzon", "lig2", "#8B1A1A"],
  ["52-orduspor", "52 Orduspor", "Ordu", "lig2", "#4B2E83"],
  ["eregli-belediyespor", "Karadeniz Ereğli Belediyespor", "Zonguldak", "lig3", "#1B4D8C"],
  ["yozgat-bozokspor", "Yozgat Belediyesi Bozokspor", "Yozgat", "lig3", "#C8102E"],
  ["fatsa-belediyespor", "Fatsa Belediyespor", "Ordu", "lig3", "#1B7A3A"],
  ["zonguldakspor", "Zonguldakspor", "Zonguldak", "lig3", "#C8102E"],
  ["pazarspor", "Pazarspor", "Rize", "lig3", "#1B7A3A"],
  ["karabuk-idman-yurdu", "Karabük İdman Yurdu", "Karabük", "lig3", "#1B4D8C"],
  ["duzcespor", "Düzcespor", "Düzce", "lig3", "#C8102E"],
  ["tokat-belediyespor", "Tokat Belediyespor", "Tokat", "lig3", "#C8102E"],
  ["orduspor-1967", "Orduspor 1967", "Ordu", "lig3", "#4B2E83"],
  ["amasyaspor", "Amasyaspor", "Amasya", "lig3", "#C8102E"],
  ["artvin-hopaspor", "Artvin Hopaspor", "Artvin", "bal", "#1B7A3A"],
  ["1926-bulancakspor", "1926 Bulancakspor", "Giresun", "bal", "#1B7A3A"],
  ["cayelispor", "Çayelispor", "Rize", "bal", "#1B4D8C"],
  ["giresunspor", "Giresunspor", "Giresun", "bal", "#1B7A3A"],
  ["kutahyaspor", "Kütahyaspor FSK", "Kütahya", "lig2", "#1B4D8C"],
  ["eskisehirspor", "Eskişehirspor", "Eskişehir", "lig3", "#C8102E"],
  ["karsiyaka", "Karşıyaka", "İzmir", "lig3", "#C8102E"],
  ["ayvalikgucu", "Ayvalıkgücü Belediyespor", "Balıkesir", "lig3", "#C8102E"],
  ["balikesirspor", "Balıkesirspor", "Balıkesir", "lig3", "#C8102E"],
  ["usakspor", "Uşakspor", "Uşak", "lig3", "#C8102E"],
  ["denizli-idman-yurdu", "Denizli İdman Yurdu", "Denizli", "lig3", "#1B7A3A"],
  ["alanya-1221", "Alanya 1221", "Antalya", "lig3", "#F5A623"],
  ["tire-2021", "Tire 2021", "İzmir", "lig3", "#1B4D8C"],
  ["soke-1970", "Söke 1970", "Aydın", "lig3", "#C8102E"],
  ["eskisehir-anadolu", "Eskişehir Anadolu", "Eskişehir", "lig3", "#C8102E"],
  ["altay", "Altay", "İzmir", "lig3", "#111111"],
  ["izmir-coruhlu", "İzmir Çoruhlu", "İzmir", "bal", "#1B4D8C"],
  ["afyonspor", "Afyonspor", "Afyonkarahisar", "bal", "#8B1A1A"],
  ["bornova-1877", "Bornova 1877", "İzmir", "bal", "#C8102E"],
  ["nazillispor", "Nazillispor", "Aydın", "bal", "#111111"],
];

function initials(name: string) {
  const parts = name.replace(/FK|SK|A\.Ş\.?/gi, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .filter((p) => !/^\d+$/.test(p))
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const ACCENT: Record<string, string> = {
  galatasaray: "#FFD100",
  fenerbahce: "#FFED00",
  besiktas: "#FFFFFF",
  trabzonspor: "#6BB6E0",
  "istanbul-basaksehir": "#003087",
  goztepe: "#FFD100",
  samsunspor: "#FFFFFF",
  "caykur-rizespor": "#009639",
  konyaspor: "#FFFFFF",
  alanyaspor: "#1B7A3A",
  kasimpasa: "#FFFFFF",
  "gaziantep-fk": "#111111",
  genclerbirligi: "#111111",
  kayserispor: "#FFD100",
  kocaelispor: "#111111",
  antalyaspor: "#FFFFFF",
  eyupspor: "#4B2E83",
  "fatih-karagumruk": "#111111",
  "mke-ankaragucu": "#1B4D8C",
  bursaspor: "#FFFFFF",
  eskisehirspor: "#111111",
  "erzurumspor-fk": "#FFFFFF",
  "adana-demirspor": "#7EC8E3",
  "amed-sfk": "#C8102E",
  sakaryaspor: "#111111",
  "corum-fk": "#111111",
  hatayspor: "#FFFFFF",
  sivasspor: "#FFFFFF",
  boluspor: "#FFFFFF",
  istanbulspor: "#111111",
  "yeni-malatyaspor": "#C8102E",
  sanliurfaspor: "#FFD100",
  elazigspor: "#1B4D8C",
  karsiyaka: "#1B7A3A",
  altay: "#FFFFFF",
  giresunspor: "#FFFFFF",
  "denizli-idman-yurdu": "#111111",
  "52-orduspor": "#FFFFFF",
  "orduspor-1967": "#FFFFFF",
  bandirmaspor: "#FFFFFF",
  "bodrum-fk": "#FFFFFF",
  "manisa-fk": "#FFFFFF",
  sariyer: "#FFFFFF",
  "yeni-mersin-idmanyurdu": "#003087",
  kutahyaspor: "#40E0D0",
  adanaspor: "#1B4D8C",
  nazillispor: "#FFD100",
  keciorengucu: "#FFFFFF",
  pendikspor: "#FFFFFF",
  umraniyespor: "#FFFFFF",
  "esenler-erokspor": "#1B4D8C",
  serikspor: "#FFFFFF",
  "igdir-fk": "#FFFFFF",
  "vanspor-fk": "#111111",
  "batman-petrolspor": "#FFFFFF",
  kastamonuspor: "#111111",
  "24-erzincanspor": "#FFFFFF",
  usakspor: "#111111",
  zonguldakspor: "#1B4D8C",
  "yalova-fk-77": "#FFFFFF",
  "karabuk-idman-yurdu": "#C8102E",
  duzcespor: "#1B4D8C",
  afyonspor: "#FFFFFF",
  edirnespor: "#FFD100",
  osmaniyespor: "#FFD100",
  kirsehir: "#FFFFFF",
  "agri-1970": "#FFFFFF",
  "isparta-32": "#C8102E",
  "kahramanmaras-istiklalspor": "#FFFFFF",
  kahramanmarasspor: "#FFFFFF",
  "mardin-1969": "#FFFFFF",
  musspor: "#FFFFFF",
  "68-aksaray": "#FFFFFF",
  kirikkale: "#FFFFFF",
  "tokat-belediyespor": "#FFFFFF",
  amasyaspor: "#FFFFFF",
  "artvin-hopaspor": "#FFFFFF",
  "1926-bulancakspor": "#FFFFFF",
  kirklarelispor: "#FFFFFF",
  "corluspor-1947": "#FFFFFF",
  "nigde-belediyesispor": "#FFFFFF",
  "suvermez-kapadokyaspor": "#C8102E",
  "kilis-1984": "#FFFFFF",
  "12-bingolspor": "#FFFFFF",
  diyarbekirspor: "#C8102E",
  "karakopru-belediyespor": "#FFD100",
  "malatya-yesilyurtspor": "#FFFFFF",
  "erciyes-38": "#FFD100",
  "fethiyespor": "#FFFFFF",
  muglaspor: "#FFFFFF",
  "ankara-demirspor": "#FFFFFF",
  ankaraspor: "#FFFFFF",
  "karaman-fk": "#FFFFFF",
  "yozgat-bozokspor": "#FFFFFF",
  pazarspor: "#FFFFFF",
  cayelispor: "#FFFFFF",
  "eregli-belediyespor": "#FFFFFF",
  "fatsa-belediyespor": "#FFFFFF",
  "sebat-genclikspor": "#6BB6E0",
  "1461-trabzon": "#6BB6E0",
  "eskisehir-anadolu": "#111111",
  balikesirspor: "#FFFFFF",
  ayvalikgucu: "#FFFFFF",
  "soke-1970": "#FFFFFF",
  "alanya-1221": "#1B7A3A",
  "inegolspor": "#FFFFFF",
  "iskenderunspor": "#1B4D8C",
  "adana-01": "#1B4D8C",
  "menemen-fk": "#FFFFFF",
  "bucaspor-1928": "#FFD100",
  altinordu: "#FFFFFF",
  somaspor: "#FFFFFF",
  "guzide-gebzespor": "#FFFFFF",
  kepezspor: "#FFFFFF",
  "polatli-1926": "#FFFFFF",
  cankayaspor: "#111111",
  etimesgutspor: "#FFFFFF",
  "turk-metal-1963": "#FFFFFF",
};

function secondColor(id: string, bleed: string) {
  if (ACCENT[id]) return ACCENT[id];
  if (bleed === "#001B48" || bleed === "#1B4D8C") return "#FFFFFF";
  if (bleed === "#F5A623") return "#1B4D8C";
  if (bleed === "#111111") return "#FFFFFF";
  return "#FFFFFF";
}

export const TEAMS: Team[] = RAW.map(([id, name, city, league, bleed]) => ({
  id,
  name,
  short: initials(name),
  city,
  league,
  bleed,
  accent: secondColor(id, bleed),
  paper: PAPER[league],
  ink: "#111",
}));

const ALIAS: Record<string, string> = {
  gs: "galatasaray",
  fb: "fenerbahce",
  bjk: "besiktas",
  ts: "trabzonspor",
  es: "eskisehirspor",
  bs: "bursaspor",
};

export const TEAM_IDS = TEAMS.map((t) => t.id);

/**
 * NTA 2026 81-il saha + internet ilgisi sıralamasının ilk 25 kulübü.
 * Explicit IDs — not TEAMS.slice. Catalog names that differ:
 * Amed SK → amed-sfk, Denizlispor → denizli-idman-yurdu,
 * Orduspor → 52-orduspor, Malatyaspor → yeni-malatyaspor,
 * Zonguldak Kömürspor → zonguldakspor.
 */
export const FORUM_ACTIVE_TEAM_IDS = [
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "bursaspor",
  "goztepe",
  "mke-ankaragucu",
  "eskisehirspor",
  "adana-demirspor",
  "kocaelispor",
  "sakaryaspor",
  "samsunspor",
  "karsiyaka",
  "antalyaspor",
  "konyaspor",
  "amed-sfk",
  "altay",
  "sivasspor",
  "kayserispor",
  "denizli-idman-yurdu",
  "erzurumspor-fk",
  "giresunspor",
  "52-orduspor",
  "yeni-malatyaspor",
  "zonguldakspor",
];

export function isForumActiveTeam(id: string) {
  return FORUM_ACTIVE_TEAM_IDS.includes(id);
}

export function getTeam(id: string) {
  const resolved = ALIAS[id] || id;
  return TEAMS.find((t) => t.id === resolved);
}

export function foldTr(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}
