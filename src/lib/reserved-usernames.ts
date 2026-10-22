import type { Db } from "./db";
import { foldTr } from "./teams";

/**
 * Usernames held back from sign-up: club names, cities, well-known club
 * nicknames and fan groups (kept so the site can hand them out later), plus
 * names that would let someone pass as the site or its staff.
 *
 * The `reserved_usernames` table is the source of truth once loaded; this file
 * only builds the initial list. A name is matched in its flat form (no `_` or
 * `.`), so `eskisehir_spor` is caught by `eskisehirspor`.
 */

export type ReservedKind = "team" | "city" | "generic";

export type ReservedEntry = {
  name: string;
  kind: ReservedKind;
  teamId: string | null;
  note: string;
};

/** The form reserved names are compared in: ASCII letters and digits only. */
export function flatUsername(value: string) {
  return foldTr(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Fan form of a name: Eskişehirspor → eskisehirsporlu, Yalova FK 77 → yalovali. */
function fanForm(name: string) {
  const word = name
    .split(/\s+/)
    .filter((part) => !/^(\d+|fk|sk|fsk|sfk)$/i.test(part))
    .join(" ");
  const folded = word.toLocaleLowerCase("tr");
  const vowels = folded.match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  return `${flatUsername(word)}${"oöuü".includes(last) ? "lu" : "li"}`;
}

/** Singular of a Turkish plural (kırmızışimşekler → kırmızışimşek). */
function singular(flat: string) {
  return /(ler|lar)$/.test(flat) && flat.length > 6 ? flat.slice(0, -3) : null;
}

const CLUB_SUFFIXES = ["belediyespor", "belediyesispor", "spor", "sfk", "fsk", "fk", "sk"];

/** Name without club suffixes or year: Eskişehirspor → eskisehir, Mardin 1969 → mardin. */
function coreOf(name: string) {
  let flat = flatUsername(name).replace(/^\d+|\d+$/g, "");
  for (let changed = true; changed; ) {
    changed = false;
    for (const suffix of CLUB_SUFFIXES) {
      if (flat.endsWith(suffix) && flat.length - suffix.length >= 3) {
        flat = flat.slice(0, -suffix.length).replace(/\d+$/g, "");
        changed = true;
      }
    }
  }
  return flat;
}

/** Short club names where the suffix rule alone gives an odd core. */
const CORE_OVERRIDE: Record<string, string> = {
  "caykur-rizespor": "rize",
  "fatih-karagumruk": "karagumruk",
  "istanbul-basaksehir": "basaksehir",
  keciorengucu: "keciorengucu",
  "mke-ankaragucu": "ankaragucu",
  "yozgat-bozokspor": "bozok",
  "kahramanmaras-istiklalspor": "istiklal",
  "kucukcekmece-sinopspor": "sinop",
  "eregli-belediyespor": "eregli",
};

/**
 * Club nicknames, fan groups, abbreviations and short names, per team id.
 * Written in Turkish; folded to ASCII when the list is built.
 */
export const TEAM_EXTRAS: Record<string, string[]> = {
  galatasaray: ["cimbom", "cimbombom", "cimbomlu", "aslan", "aslanlar", "sarı kırmızı", "sarı kırmızılılar", "ultraslan", "gs1905", "galatasaray1905", "ali sami yen"],
  fenerbahce: ["fener", "fenerli", "fb1907", "fenerbahçe1907", "sarı lacivert", "sarı lacivertliler", "kanarya", "kanaryalar", "genç fenerbahçeliler", "gfb", "kadıköy", "şükrü saracoğlu", "saracoğlu"],
  besiktas: ["bjk", "bjk1903", "beşiktaş1903", "kartal", "kartallar", "kara kartal", "kara kartallar", "siyah beyaz", "siyah beyazlılar", "çarşı", "inönü"],
  trabzonspor: ["ts1967", "trabzonspor1967", "bordo mavi", "bordo mavililer", "fırtına", "karadeniz fırtınası"],
  "istanbul-basaksehir": ["başakşehir", "başakşehirspor", "başakşehirli", "ibfk", "turuncu lacivert"],
  alanyaspor: ["turuncu yeşil", "turuncu yeşilliler"],
  "amed-sfk": ["amed", "amedspor", "amed sportif", "amedli"],
  "caykur-rizespor": ["rizespor", "rizesporlu", "çaykur", "yeşil mavi", "yeşil mavililer"],
  "corum-fk": ["çorumspor"],
  "erzurumspor-fk": ["erzurumspor", "dadaş", "dadaşlar"],
  eyupspor: ["eyüp", "mor sarı", "mor sarılılar"],
  "gaziantep-fk": ["gaziantepspor", "antep", "antepspor", "antepli", "gazişehir"],
  genclerbirligi: ["gençler", "gençlerbirlikli", "ankara gençlerbirliği", "kırmızı kara", "kırmızı karalılar"],
  goztepe: ["göz göz", "göztepeli", "göztepe1925"],
  kasimpasa: ["kasımpaşaspor"],
  kocaelispor: ["yeşil siyah", "yeşil siyahlılar"],
  konyaspor: ["anadolu kartalı", "yeşil beyaz", "yeşil beyazlılar"],
  samsunspor: ["kırmızı beyaz", "kırmızı beyazlılar"],
  keciorengucu: ["keçiören", "keçiörengücü"],
  antalyaspor: ["akrep", "akrepler"],
  bursaspor: ["timsah", "timsahlar", "yeşil timsah", "teksas"],
  "fatih-karagumruk": ["karagümrük", "karagümrükspor", "fatih"],
  sivasspor: ["yiğido", "yiğidolar"],
  umraniyespor: ["ümraniye"],
  "vanspor-fk": ["vanspor"],
  "mke-ankaragucu": ["ankaragücü", "ankaragüçlü", "mke", "gecekondu"],
  sakaryaspor: ["tatanga", "tatangalar"],
  "adana-demirspor": ["ads", "demirspor", "mavi şimşek", "mavi şimşekler"],
  hatayspor: ["antakya"],
  elazigspor: ["gakgoş", "gakgoşlar"],
  sanliurfaspor: ["urfa", "urfaspor", "urfalı"],
  karsiyaka: ["kaf kaf", "ksk", "kska", "yeşil kırmızı", "karşıyakalı"],
  eskisehirspor: ["es es", "esesli", "kırmızı şimşek", "kırmızı şimşekler", "şimşek", "şimşekler", "eskişehirspor1965"],
  giresunspor: ["çotanak", "çotanaklar"],
  "yeni-malatyaspor": ["yms", "malatyaspor"],
  kahramanmarasspor: ["maraş", "maraşspor"],
  "karabuk-idman-yurdu": ["karabükspor", "kardemir karabükspor"],
  "bucaspor-1928": ["bucaspor", "buca"],
  "1461-trabzon": ["1461"],
  "52-orduspor": ["orduspor"],
  "yozgat-bozokspor": ["yozgatspor", "yozgat bozokspor"],
  "orduspor-1967": ["orduspor"],
};

/** Site, staff, system and football-wide names. */
export const GENERIC_RESERVED: string[] = [
  // Site and staff
  "admin", "administrator", "yonetici", "yonetim", "moderator", "moderatör", "mod", "modlar",
  "bizimtribun", "bizimtribün", "bizim tribün", "tribun", "tribün", "resmi", "official",
  "destek", "support", "yardım", "help", "iletişim", "contact", "bilgi", "info", "ekip", "staff",
  "sistem", "system", "root", "superadmin", "sahip", "owner", "kurucu", "founder",
  "kvkk", "hukuk", "legal", "güvenlik", "security", "abuse", "noreply", "postmaster", "webmaster",
  "hostmaster", "mail", "eposta", "www", "api", "app", "test", "null", "undefined", "anonim",
  "anonymous", "misafir", "guest", "üye", "üyeler", "profil", "hesap", "giriş", "çıkış", "kayıt",
  "forum", "haber", "haberler", "duyuru", "duyurular", "bot",
  // National team and football bodies
  "milli takım", "milli takım tribünü", "millitakim", "türkiye", "turkey", "ay yıldız", "ay yıldızlılar",
  "bizim çocuklar", "tff", "fifa", "uefa", "süper lig", "trendyol süper lig", "1. lig", "trendyol 1. lig",
  "2. lig", "3. lig", "bal",
  // Football words
  "taraftar", "taraftarlar", "futbol", "gol", "maç", "derbi", "hakem", "ultras", "ultra", "kaptan",
  "haftanın taraftarı",
];

/** Builds the reserved list for the given teams and provinces, flat and de-duplicated. */
export function buildReservedUsernames(
  teams: { id: string; name: string; city: string | null }[],
  provinces: readonly string[],
): ReservedEntry[] {
  const seen = new Map<string, ReservedEntry>();
  const add = (raw: string, kind: ReservedKind, teamId: string | null, note: string) => {
    const name = flatUsername(raw);
    if (name.length < 3 || name.length > 20 || seen.has(name)) return;
    seen.set(name, { name, kind, teamId, note });
  };

  for (const raw of GENERIC_RESERVED) add(raw, "generic", null, "Site / genel");

  for (const team of teams) {
    const full = flatUsername(team.name);
    const core = CORE_OVERRIDE[team.id] ?? coreOf(team.name);
    const label = team.name;
    add(full, "team", team.id, label);
    add(team.id, "team", team.id, label);
    add(full.replace(/\d+/g, ""), "team", team.id, label);
    if (core) {
      add(core, "team", team.id, label);
      add(`${core}spor`, "team", team.id, label);
      add(`${core}sk`, "team", team.id, label);
      add(`${core}fk`, "team", team.id, label);
    }
    if (full.endsWith("spor")) add(`${full}sk`, "team", team.id, label);
    add(fanForm(team.name), "team", team.id, label);
    for (const extra of TEAM_EXTRAS[team.id] ?? []) {
      const flat = flatUsername(extra);
      add(flat, "team", team.id, label);
      const one = singular(flat);
      if (one) add(one, "team", team.id, label);
    }
  }

  for (const province of provinces) {
    add(province, "city", null, province);
    add(fanForm(province), "city", null, province);
  }

  return [...seen.values()];
}

/** True while `username` (in any spelling: `Eskisehir_Spor`) is held back. */
export async function isUsernameReserved(db: Db, username: string) {
  const row = await db
    .prepare(`SELECT 1 FROM reserved_usernames WHERE name = ? AND released_at IS NULL`)
    .get(flatUsername(username));
  return Boolean(row);
}

export type ReservedRow = {
  name: string;
  kind: ReservedKind | "manual";
  teamId: string | null;
  teamName: string | null;
  note: string | null;
  createdAt: string;
  releasedAt: string | null;
};

export async function listReservedUsernames(
  db: Db,
  opts: { q: string | null; state: "reserved" | "released"; offset: number; limit: number },
) {
  const where = [opts.state === "released" ? "r.released_at IS NOT NULL" : "r.released_at IS NULL"];
  const params: unknown[] = [];
  if (opts.q) {
    where.push(`(r.name LIKE ? OR t.name ILIKE ? OR r.note ILIKE ?)`);
    params.push(`%${flatUsername(opts.q)}%`, `%${opts.q}%`, `%${opts.q}%`);
  }
  const from = `FROM reserved_usernames r LEFT JOIN teams t ON t.id = r.team_id WHERE ${where.join(" AND ")}`;
  const total = (await db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...params)) as { n: number | string };
  const rows = (await db
    .prepare(
      `SELECT r.name, r.kind, r.team_id, t.name AS team_name, r.note, r.created_at, r.released_at
       ${from} ORDER BY r.name LIMIT ? OFFSET ?`,
    )
    .all(...params, opts.limit, opts.offset)) as {
    name: string;
    kind: ReservedRow["kind"];
    team_id: string | null;
    team_name: string | null;
    note: string | null;
    created_at: string;
    released_at: string | null;
  }[];
  return {
    total: Number(total.n),
    items: rows.map(
      (r): ReservedRow => ({
        name: r.name,
        kind: r.kind,
        teamId: r.team_id,
        teamName: r.team_name,
        note: r.note,
        createdAt: r.created_at,
        releasedAt: r.released_at,
      }),
    ),
  };
}

/** Lets anyone sign up with the name again. */
export async function releaseReservedUsername(db: Db, name: string, actorUserId: number) {
  const result = await db
    .prepare(
      `UPDATE reserved_usernames SET released_at = ?, released_by_user_id = ?
       WHERE name = ? AND released_at IS NULL`,
    )
    .run(new Date().toISOString(), actorUserId, flatUsername(name));
  return result.changes > 0;
}

/**
 * Holds a name back (again). A name a member already uses stays theirs; the
 * reservation only stops new sign-ups.
 */
export async function reserveUsername(db: Db, raw: string, note: string | null) {
  const name = flatUsername(raw);
  if (!/^[a-z0-9]{3,20}$/.test(name)) {
    return { ok: false as const, error: "Ad 3–20 karakter olmalı; yalnızca harf ve rakam." };
  }
  await db
    .prepare(
      `INSERT INTO reserved_usernames (name, kind, note, created_at) VALUES (?, 'manual', ?, ?)
       ON CONFLICT (name) DO UPDATE SET released_at = NULL, released_by_user_id = NULL`,
    )
    .run(name, note, new Date().toISOString());
  return { ok: true as const, name };
}
