import { requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { listLeagues, listTeamCatalog } from "@/lib/team-catalog";
import { currentSeason, listSeasons } from "@/lib/team-admin";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req, "teams.manage");
  if (!gate.ok) return gate.res;
  const db = getDb();
  const votes = new Map(
    (
      db
        .prepare(`SELECT team_id, COUNT(*) as c FROM fan_votes WHERE status = 'active' GROUP BY team_id`)
        .all() as { team_id: string; c: number }[]
    ).map((r) => [r.team_id, r.c]),
  );
  return noStoreJson({
    ok: true,
    teams: listTeamCatalog().map((t) => ({ ...t, votes: votes.get(t.id) ?? 0 })),
    leagues: listLeagues(),
    seasons: listSeasons(db).map((s) => ({
      id: s.id,
      label: s.label,
      startsOn: s.starts_on,
      endsOn: s.ends_on,
      isCurrent: s.is_current === 1,
      teamCount: s.team_count,
    })),
    currentSeason: currentSeason(db)?.label ?? null,
  });
}
