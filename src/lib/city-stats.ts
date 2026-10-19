import { rankCityTeams, type CityTeamRow } from "./city-rank";
import { getDb } from "./db";
import { listTeamCatalog } from "./team-catalog";

export type { CityTeamRow };

export function cityVoteTotals(cityName: string) {
  const rows = getDb()
    .prepare(
      `SELECT fv.team_id as teamId, COUNT(*) as votes
       FROM fan_votes fv
       WHERE fv.status = 'active' AND fv.city = ?
       GROUP BY fv.team_id
       ORDER BY votes DESC, fv.team_id`,
    )
    .all(cityName) as { teamId: string; votes: number }[];
  const total = rows.reduce((sum, row) => sum + row.votes, 0);
  const catalog = new Map(listTeamCatalog().map((t) => [t.id, t]));
  return { total, rows: rankCityTeams(rows, (id) => catalog.get(id)) };
}
