import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const standings = await cityStandings();
  return noStoreJson({
    teams: await teamCounts(),
    total: await totalVerified(),
    cities: await cityLeaders(standings),
    standings,
    leagues: await listLeagues(),
    season: (await currentSeason(getDb()))?.label ?? null,
    generatedAt: new Date().toISOString(),
  });
}
