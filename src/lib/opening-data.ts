import { getSettings } from "./site-settings";
import { leaderOf, type CityLeader, type CityStanding } from "./stats";
import { listTeamCatalog } from "./team-catalog";
import { CITIES } from "./cities";
import { TEAM_IDS } from "./teams";

/**
 * "Açılış verisi": a few clearly labelled starter numbers so the home map is
 * not empty on launch day. They are never written to fan_votes and never
 * reach team/province pages, titles, FAQ, structured data, llms.txt or share
 * cards; only the home map and its counters add them, with a visible note.
 * An admin switches them off for good from /admin/ayarlar.
 *
 * Each active team gets 3-5 in its own province: the province's flagship club
 * (highest league, then the curated order in teams.ts) and the big three get
 * 5, so they lead at home; the rest get 3-4. Provinces without a team of
 * their own get 3-4 spread over the big three. The numbers are derived from
 * the ids, so they are the same on every request.
 */
const BIG_THREE = ["galatasaray", "fenerbahce", "besiktas"];

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
  const curated = (id: string) => {
    const i = TEAM_IDS.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  // The catalog is sorted by league, so the first team seen in a province
  // plays in its highest league; the curated order breaks ties inside it.
  const flagship = new Map<string, { id: string; league: string }>();
  for (const team of teams) {
    const best = flagship.get(team.city);
    if (!best || (best.league === team.league && curated(team.id) < curated(best.id))) {
      flagship.set(team.city, { id: team.id, league: team.league });
    }
  }
  const covered = new Set<string>();
  for (const team of teams) {
    if (!CITIES.some((c) => c.name === team.city)) continue;
    covered.add(team.city);
    const top = flagship.get(team.city)?.id === team.id || BIG_THREE.includes(team.id);
    out.push({ city: team.city, teamId: team.id, votes: top ? 5 : 3 + pick(team.id, 2) });
  }
  const big = BIG_THREE.filter((id) => known.has(id));
  if (big.length === 0) return out;
  for (const city of CITIES) {
    if (covered.has(city.name)) continue;
    const start = pick(city.slug, big.length);
    const order = big.map((_, i) => big[(start + i) % big.length]);
    const shares = pick(`${city.slug}:n`, 2) === 0 ? [2, 1] : [2, 1, 1];
    shares.forEach((votes, i) => {
      if (order[i]) out.push({ city: city.name, teamId: order[i], votes });
    });
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
