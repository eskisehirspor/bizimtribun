import HomeClient from "@/components/HomeClient";
import HomeTeamCounts from "@/components/HomeTeamCounts";
import JsonLd from "@/components/JsonLd";
import { getDb } from "@/lib/db";
import type { Metadata } from "next";
import { featuredPublicTopics, recentPublicTopics } from "@/lib/home-feed";
import { getSettings } from "@/lib/site-settings";
import { cityLeaders, cityStandings, teamCounts, totalVerified } from "@/lib/stats";
import { currentSeason } from "@/lib/team-admin";
import { listLeagues } from "@/lib/team-catalog";
import { DEFAULT_SHARE_IMAGE, graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

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
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.siteTitle,
      description: seo.siteDescription,
      images: [DEFAULT_SHARE_IMAGE.url],
    },
  };
}

export default async function Home() {
  const standings = await cityStandings();
  const settings = await getSettings();
  const teams = await teamCounts();
  const total = await totalVerified();
  return (
    <>
      <JsonLd data={graph(organizationJsonLd(Object.values(settings.socialLinks)), websiteJsonLd())} />
      <HomeClient
        initialTeams={teams}
        initialTotal={total}
        initialCities={await cityLeaders(standings)}
        initialStandings={standings}
        leagues={await listLeagues()}
        season={(await currentSeason(getDb()))?.label ?? null}
        recentTopics={await recentPublicTopics(8)}
        featuredTopics={await featuredPublicTopics(settings.featuredTopics.ids)}
        homeLeagueIds={settings.homeLeagues.ids}
        generatedAt={new Date().toISOString()}
      />
      <HomeTeamCounts teams={teams} total={total} />
    </>
  );
}
