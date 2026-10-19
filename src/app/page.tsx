import HomeClient from "@/components/HomeClient";
import { getDb } from "@/lib/db";
import type { Metadata } from "next";
import { featuredPublicTopics, recentPublicTopics } from "@/lib/home-feed";
import { getSettings } from "@/lib/site-settings";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

function origin() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = getSettings();
  return {
    title: seo.siteTitle,
    description: seo.siteDescription,
    alternates: { canonical: `${origin()}/` },
    openGraph: {
      title: seo.siteTitle,
      description: seo.siteDescription,
      url: `${origin()}/`,
      locale: "tr_TR",
      type: "website",
      siteName: "Bizim Tribün",
    },
    twitter: { card: "summary_large_image", title: seo.siteTitle, description: seo.siteDescription },
  };
}

export default function Home() {
  const standings = cityStandings();
  const settings = getSettings();
  return (
    <HomeClient
      initialTeams={teamCounts()}
      initialTotal={totalVerified()}
      initialCities={cityLeaders(standings)}
      initialStandings={standings}
      leagues={listLeagues()}
      season={currentSeason(getDb())?.label ?? null}
      recentTopics={recentPublicTopics(8)}
      featuredTopics={featuredPublicTopics(settings.featuredTopics.ids)}
      homeLeagueIds={settings.homeLeagues.ids}
      socialLinks={settings.socialLinks}
      generatedAt={new Date().toISOString()}
    />
  );
}
