import { getSettings } from "./site-settings";
import { leaderOf, type CityLeader, type CityStanding } from "./stats";
import { listTeamCatalog } from "./team-catalog";
import { CITIES } from "./cities";

/**
 * "Açılış verisi": a few clearly labelled starter numbers so the home map is
 * not empty on launch day. They are never written to fan_votes and never
 * reach team/province pages, titles, FAQ, structured data, llms.txt or share
 * cards; only the home map and its counters add them, with a visible note.
 * An admin switches them off for good from /admin/ayarlar.
 *
 * Six provinces are led by their own club (LOCAL_LEADERS). Every other
 * province is led by the big-three club that public surveys put first there
 * (SURVEY_LEADERS; Galatasaray where none is listed): the leader gets 5, the
 * other two 3. Every other active club gets a small 1-2 at home, or 3-4 in
 * the six local provinces, so no club shows zero. The numbers are derived
 * from the ids, so they are the same on every request.
 */
const BIG_THREE = ["galatasaray", "fenerbahce", "besiktas"];

const LOCAL_LEADERS: Record<string, string> = {
  Eskişehir: "eskisehirspor",
  Bursa: "bursaspor",
  Sakarya: "sakaryaspor",
  Kocaeli: "kocaelispor",
  Trabzon: "trabzonspor",
  İzmir: "goztepe",
};

/**
 * Provinces where the survey leader is not Galatasaray. Source: the 81-province
 * fan map published by Sabah (research company study), as reprinted by
 * Yeni Şafak on 25.04.2026 and Sözcü on 19.09.2026. Sivas, listed there for
 * Sivasspor, falls back to Galatasaray, the national leader.
 */
const SURVEY_LEADERS: Record<string, string> = {
  Afyonkarahisar: "fenerbahce",
  Aksaray: "fenerbahce",
  Amasya: "fenerbahce",
  Bitlis: "fenerbahce",
  Burdur: "fenerbahce",
  Çorum: "fenerbahce",
  Denizli: "fenerbahce",
  Erzurum: "fenerbahce",
  Gümüşhane: "fenerbahce",
  Hatay: "fenerbahce",
  Karabük: "fenerbahce",
  Kastamonu: "fenerbahce",
  Kırşehir: "fenerbahce",
  Tokat: "fenerbahce",
  Yalova: "fenerbahce",
  Yozgat: "fenerbahce",
  Ardahan: "besiktas",
};

function pick(seed: string, mod: number) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % mod;
}

export type OpeningVote = { city: string; teamId: string; votes: number };

export async function openingVotes(): Promise<OpeningVote[]> {
  const teams = (await listTeamCatalog()).filter((t) => t.isActive);
  const known = new Set(teams.map((t) => t.id));
  const out: OpeningVote[] = [];
  for (const city of CITIES) {
    const local = LOCAL_LEADERS[city.name];
    if (local && known.has(local)) continue;
    const leader = SURVEY_LEADERS[city.name] ?? "galatasaray";
    for (const id of BIG_THREE) {
      if (known.has(id)) out.push({ city: city.name, teamId: id, votes: id === leader ? 5 : 3 });
    }
  }
  for (const team of teams) {
    if (BIG_THREE.includes(team.id) || !CITIES.some((c) => c.name === team.city)) continue;
    const local = LOCAL_LEADERS[team.city];
    const votes = !local || !known.has(local) ? 1 + pick(team.id, 2) : local === team.id ? 5 : 3 + pick(team.id, 2);
    out.push({ city: team.city, teamId: team.id, votes });
  }
  return out;
}

export async function openingDataEnabled() {
  return (await getSettings()).openingData.enabled;
}

type TeamRow = { id: string; votes: number };

/**
 * Real numbers plus the opening data, for the home page and /api/stats only.
 * `opening` is the number of starter votes inside `total` (0 when off).
 */
export async function withOpeningData<T extends TeamRow>(real: {
  teams: T[];
  total: number;
  standings: Record<string, CityStanding[]>;
}): Promise<{
  teams: T[];
  total: number;
  standings: Record<string, CityStanding[]>;
  cities: Record<string, CityLeader>;
  opening: number;
}> {
  const seeds = (await openingDataEnabled()) ? await openingVotes() : [];
  const byTeam = new Map<string, number>();
  const byCity = new Map<string, Map<string, number>>();
  for (const [city, rows] of Object.entries(real.standings)) {
    byCity.set(city, new Map(rows.map((r) => [r.teamId, r.votes])));
  }
  let opening = 0;
  const listed = new Set(real.teams.map((t) => t.id));
  for (const s of seeds) {
    if (!listed.has(s.teamId)) continue;
    opening += s.votes;
    byTeam.set(s.teamId, (byTeam.get(s.teamId) ?? 0) + s.votes);
    const city = byCity.get(s.city) ?? new Map<string, number>();
    city.set(s.teamId, (city.get(s.teamId) ?? 0) + s.votes);
    byCity.set(s.city, city);
  }
  const standings: Record<string, CityStanding[]> = {};
  const cities: Record<string, CityLeader> = {};
  for (const [city, map] of byCity) {
    const rows = [...map]
      .map(([teamId, votes]) => ({ teamId, votes }))
      .sort((a, b) => b.votes - a.votes || a.teamId.localeCompare(b.teamId));
    standings[city] = rows;
    const leader = leaderOf(rows);
    if (leader) cities[city] = leader;
  }
  return {
    teams: real.teams.map((t) => ({ ...t, votes: t.votes + (byTeam.get(t.id) ?? 0) })),
    total: real.total + opening,
    standings,
    cities,
    opening,
  };
}
