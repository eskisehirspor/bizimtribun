import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const standings = cityStandings();
  return noStoreJson({
    teams: teamCounts(),
    total: totalVerified(),
    cities: cityLeaders(standings),
    standings,
    leagues: listLeagues(),
    season: currentSeason(getDb())?.label ?? null,
    generatedAt: new Date().toISOString(),
  });
}
