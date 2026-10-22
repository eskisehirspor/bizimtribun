import HomeClient from "@/components/HomeClient";
import JsonLd from "@/components/JsonLd";
import { getDb } from "@/lib/db";
import type { Metadata } from "next";
import { featuredPublicTopics, recentPublicTopics } from "@/lib/home-feed";
import { getSettings } from "@/lib/site-settings";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";
import { graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

function origin() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSettings();
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

export default async function Home() {
  const standings = await cityStandings();
  const settings = await getSettings();
  return (
    <>
      <JsonLd data={graph(organizationJsonLd(), websiteJsonLd())} />
      <HomeClient
        initialTeams={await teamCounts()}
        initialTotal={await totalVerified()}
        initialCities={await cityLeaders(standings)}
        initialStandings={standings}
        leagues={await listLeagues()}
        season={(await currentSeason(getDb()))?.label ?? null}
        recentTopics={await recentPublicTopics(8)}
        featuredTopics={await featuredPublicTopics(settings.featuredTopics.ids)}
        homeLeagueIds={settings.homeLeagues.ids}
        generatedAt={new Date().toISOString()}
      />
    </>
  );
}
