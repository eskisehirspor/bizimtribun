import type { Metadata } from "next";
import { appUrl } from "./request";
import type { CatalogTeam } from "./team-catalog";

export function teamCanonical(id: string) {
  return `${appUrl().replace(/\/$/, "")}/takim/${id}`;
}

export function teamPageMetadata(team: CatalogTeam, leagueName: string): Metadata {
  const title = `${team.name} Taraftar Sayısı ve İl Dağılımı | Bizim Tribün`;
  const description = `${team.name} (${leagueName}, ${team.city}) için SMS ile doğrulanmış taraftar sayısı, sıralama ve illere göre dağılım.`;
  const url = teamCanonical(team.id);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, locale: "tr_TR", type: "website", siteName: "Bizim Tribün" },
    twitter: { card: "summary_large_image", title, description },
  };
}
