import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { withOpeningData } from "@/lib/opening-data";
import { cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  // The home map's numbers: real votes plus the labelled opening data, if on.
  const shown = await withOpeningData({
    teams: await teamCounts(),
    total: await totalVerified(),
    standings: await cityStandings(),
  });
  return noStoreJson({
    teams: shown.teams,
    total: shown.total,
    cities: shown.cities,
    standings: shown.standings,
    opening: shown.opening,
    leagues: await listLeagues(),
    season: (await currentSeason(getDb()))?.label ?? null,
    generatedAt: new Date().toISOString(),
  });
}
