import { rankCityTeams, type CityTeamRow } from "./city-rank";
import { getDb } from "./db";
import { applyDemoVotes, isDemoRuntime } from "./seed-votes";
import { liveVotesWhere } from "./votes";

export type { CityTeamRow };

function withSeed() {
  if (isDemoRuntime()) applyDemoVotes(getDb());
  return getDb();
}

export function cityVoteTotals(cityName: string) {
  const live = liveVotesWhere();
  const db = withSeed();
  const rows = db
    .prepare(
      `SELECT v.team_id as teamId, COUNT(*) as votes
       FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE ${live.sql} AND v.city = ?
       GROUP BY v.team_id
       ORDER BY votes DESC`,
    )
    .all(...live.params, cityName) as { teamId: string; votes: number }[];
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  return { total, rows: rankCityTeams(rows) };
}
