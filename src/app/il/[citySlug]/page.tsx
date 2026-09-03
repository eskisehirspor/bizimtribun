import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CityPageView from "@/components/CityPageView";
import { CITIES, getCityBySlug } from "@/lib/cities";
import { cityPageMetadata } from "@/lib/city-seo";
import { cityVoteTotals } from "@/lib/city-stats";

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
  const { total, rows } = cityVoteTotals(city.name);
  return <CityPageView city={city} total={total} rows={rows} />;
}
