import HomeClient from "@/components/HomeClient";
import { recentPublicTopics } from "@/lib/home-feed";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function Home() {
  const standings = cityStandings();
  return (
    <HomeClient
      initialTeams={teamCounts()}
      initialTotal={totalVerified()}
      initialCities={cityLeaders(standings)}
      initialStandings={standings}
      recentTopics={recentPublicTopics(8)}
      generatedAt={new Date().toISOString()}
    />
  );
}
