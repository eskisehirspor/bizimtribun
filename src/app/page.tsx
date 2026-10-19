import HomeClient from "@/components/HomeClient";
import { getDb } from "@/lib/db";
import { recentPublicTopics } from "@/lib/home-feed";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

export default function Home() {
  const standings = cityStandings();
  return (
    <HomeClient
      initialTeams={teamCounts()}
      initialTotal={totalVerified()}
      initialCities={cityLeaders(standings)}
      initialStandings={standings}
      leagues={listLeagues()}
      season={currentSeason(getDb())?.label ?? null}
      recentTopics={recentPublicTopics(8)}
      generatedAt={new Date().toISOString()}
    />
  );
}
