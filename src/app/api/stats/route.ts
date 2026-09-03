import { isPhoneVerificationEnabled } from "@/lib/phone-verification";
import { noStoreJson } from "@/lib/http";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson({
    teams: teamCounts(),
    total: totalVerified(),
    cities: cityLeaders(),
    standings: cityStandings(),
    phoneVerificationRequired: isPhoneVerificationEnabled(),
  });
}
