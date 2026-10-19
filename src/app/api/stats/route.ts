import { noStoreJson } from "@/lib/http";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const standings = cityStandings();
  return noStoreJson({
    teams: teamCounts(),
    total: totalVerified(),
    cities: cityLeaders(standings),
    standings,
    generatedAt: new Date().toISOString(),
  });
}
