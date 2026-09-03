import HomeClient from "@/components/HomeClient";
import { isPhoneVerificationEnabled } from "@/lib/phone-verification";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <HomeClient
      initialTeams={teamCounts()}
      initialTotal={totalVerified()}
      initialCities={cityLeaders()}
      initialStandings={cityStandings()}
      initialPhoneVerificationRequired={isPhoneVerificationEnabled()}
    />
  );
}
