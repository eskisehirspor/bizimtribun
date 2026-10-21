import { getDb } from "./db";
import { listTeamCatalog } from "./team-catalog";
import type { LeagueId } from "./teams";

export type MembershipTeam = {
  id: string;
  name: string;
  league: LeagueId;
};

/** Teams that can receive a new vote (inactive teams keep their history). */
export function listMembershipTeams(): MembershipTeam[] {
  return listTeamCatalog({ activeOnly: true }).map((t) => ({
    id: t.id,
    name: t.name,
    league: t.league,
  }));
}

export function membershipTeamExists(id: string) {
  const row = getDb()
    .prepare(`SELECT id FROM teams WHERE id = ?`)
    .get(id) as { id: string } | undefined;
  return Boolean(row);
}
