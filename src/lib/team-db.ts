import { getDb } from "./db";
import { LEAGUE_ORDER, type LeagueId } from "./teams";

export type MembershipTeam = {
  id: string;
  name: string;
  league: LeagueId;
};

export function listMembershipTeams(): MembershipTeam[] {
  const rows = getDb()
    .prepare(`SELECT id, name, league FROM teams`)
    .all() as MembershipTeam[];
  const order = new Map(LEAGUE_ORDER.map((id, i) => [id, i]));
  return rows.sort((a, b) => {
    const la = order.get(a.league) ?? 99;
    const lb = order.get(b.league) ?? 99;
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name, "tr");
  });
}

export function membershipTeamExists(id: string) {
  const row = getDb()
    .prepare(`SELECT id FROM teams WHERE id = ?`)
    .get(id) as { id: string } | undefined;
  return Boolean(row);
}
