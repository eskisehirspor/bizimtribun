import { FORUM_ACTIVE_TEAM_IDS, getTeam } from "./teams";

export type CityStanding = { teamId: string; votes: number };

/** Largest-remainder percents so shares always sum to 100 (or 0). */
export function integerPercents(votes: number[]) {
  const total = votes.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return votes.map(() => 0);
  const parts = votes.map((n, index) => {
    const exact = (n * 100) / total;
    const floor = Math.floor(exact);
    return { index, floor, frac: exact - floor };
  });
  let leftover = 100 - parts.reduce((sum, p) => sum + p.floor, 0);
  parts.sort((a, b) => b.frac - a.frac || a.index - b.index);
  const extra = new Set<number>();
  for (let i = 0; i < leftover; i++) extra.add(parts[i]!.index);
  return votes.map((_, index) => {
    const floor = Math.floor((votes[index]! * 100) / total);
    return floor + (extra.has(index) ? 1 : 0);
  });
}

export type CityTeamRow = {
  teamId: string;
  name: string;
  votes: number;
  percent: number;
  forumHref: string | null;
};

export function rankCityTeams(standings: CityStanding[]): CityTeamRow[] {
  const ordered = [...standings].sort((a, b) => b.votes - a.votes);
  const percents = integerPercents(ordered.map((row) => row.votes));
  return ordered.map((row, i) => {
    const team = getTeam(row.teamId);
    const forumHref = FORUM_ACTIVE_TEAM_IDS.includes(row.teamId)
      ? `/takim/${row.teamId}/forum`
      : null;
    return {
      teamId: row.teamId,
      name: team?.name ?? row.teamId,
      votes: row.votes,
      percent: percents[i] ?? 0,
      forumHref,
    };
  });
}

export function compactCityPreview(rows: CityStanding[]) {
  const ranked = rankCityTeams(rows);
  const total = ranked.reduce((sum, row) => sum + row.votes, 0);
  return {
    total,
    first: ranked[0]
      ? { name: ranked[0].name, percent: ranked[0].percent }
      : null,
    second: ranked[1]
      ? { name: ranked[1].name, percent: ranked[1].percent }
      : null,
  };
}
