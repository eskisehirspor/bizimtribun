import { rankCityTeams, type CityTeamRow } from "./city-rank";
import { getDb } from "./db";
import { listTeamCatalog } from "./team-catalog";

export type { CityTeamRow };

export async function cityVoteTotals(cityName: string) {
  const rows = await getDb()
      .prepare(
        `SELECT fv.team_id as teamId, COUNT(*) as votes
       FROM fan_votes fv
       WHERE fv.status = 'active' AND fv.city = ?
       GROUP BY fv.team_id
       ORDER BY votes DESC, fv.team_id`,
      )
      .all(cityName) as { teamId: string; votes: number }[];
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const catalog = new Map((await listTeamCatalog()).map((t) => [t.id, t]));
  return { total, rows: rankCityTeams(rows, (id) => catalog.get(id)) };
}

export type CityHistoryPoint = {
  /** End of the week (exclusive), ISO date. */
  weekEnding: string;
  total: number;
  leaderIds: string[];
  leaderVotes: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How the province looked at the end of each of the last `weeks` weeks,
 * rebuilt from the vote rows themselves (cast_at / voided_at), so there is
 * no separate snapshot table that could drift from the real data. A vote
 * voided later counts for the weeks before it was voided.
 */
export async function cityHistory(cityName: string, weeks = 8, now = Date.now()): Promise<CityHistoryPoint[]> {
  const votes = await getDb()
      .prepare(`SELECT team_id, cast_at, voided_at FROM fan_votes WHERE city = ?`)
      .all(cityName) as { team_id: string; cast_at: string; voided_at: string | null }[];
  const parsed = votes.map((v) => ({
    team: v.team_id,
    cast: Date.parse(v.cast_at),
    voided: v.voided_at ? Date.parse(v.voided_at) : Infinity,
  }));
  const out: CityHistoryPoint[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = now - i * WEEK_MS;
    const counts = new Map<string, number>();
    for (const v of parsed) {
      if (v.cast < end && v.voided >= end) counts.set(v.team, (counts.get(v.team) ?? 0) + 1);
    }
    let top = 0;
    for (const c of counts.values()) top = Math.max(top, c);
    const leaderIds = top > 0 ? [...counts].filter(([, c]) => c === top).map(([id]) => id).sort() : [];
    out.push({
      weekEnding: new Date(end).toISOString().slice(0, 10),
      total: [...counts.values()].reduce((a, b) => a + b, 0),
      leaderIds,
      leaderVotes: top,
    });
  }
  return out;
}

export async function cityLastVoteAt(cityName: string) {
  const row = await getDb()
      .prepare(`SELECT MAX(cast_at) as at FROM fan_votes WHERE city = ? AND status = 'active'`)
      .get(cityName) as { at: string | null };
  return row.at;
}
