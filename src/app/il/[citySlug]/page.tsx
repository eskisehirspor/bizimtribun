import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CityPageView from "@/components/CityPageView";
import JsonLd from "@/components/JsonLd";
import { CITIES, getCityBySlug } from "@/lib/cities";
import { cityPageMetadata } from "@/lib/city-seo";
import { HOME_CRUMB, breadcrumbJsonLd, graph } from "@/lib/seo";
import { cityHistory, cityLastVoteAt, cityVoteTotals } from "@/lib/city-stats";
import { getSessionUser } from "@/lib/auth";
import { memberTeamId } from "@/lib/forum";
import { isStaffRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CITIES.map((city) => ({ citySlug: city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}): Promise<Metadata> {
  const { citySlug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) return { robots: { index: false, follow: false } };
  return cityPageMetadata(city);
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) notFound();
  const { total, rows } = await cityVoteTotals(city.name);
  const viewer = await getSessionUser();
  const viewerTeamId = viewer ? await memberTeamId(viewer.id) : null;
  return (
    <>
      <JsonLd
        data={graph(breadcrumbJsonLd([HOME_CRUMB, { name: `${city.name} taraftar sayımı`, path: `/il/${city.slug}` }]))}
      />
      <CityPageView
        city={city}
        total={total}
        rows={rows}
        history={await cityHistory(city.name)}
        lastVoteAt={await cityLastVoteAt(city.name)}
        generatedAt={new Date().toISOString()}
        viewerTeamId={viewerTeamId}
        viewerIsStaff={Boolean(viewer && isStaffRole(viewer.role))}
        voteCta={!viewer ? "guest" : viewerTeamId ? null : "novote"}
      />
    </>
  );
}
