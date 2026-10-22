import type { Metadata } from "next";
import { appUrl } from "./request";
import type { CatalogTeam } from "./team-catalog";

export function teamCanonical(id: string) {
  return `${appUrl().replace(/\/$/, "")}/takim/${id}`;
}

/** Matches searches like "Eskişehirspor kaç taraftarı var" and quotes the live count. */
export function teamPageMetadata(
  team: CatalogTeam,
  leagueName: string,
  counts?: { votes: number; rank: number | null } | null,
): Metadata {
  const title = `${team.name} Kaç Taraftarı Var? Taraftar Sayısı | Bizim Tribün`;
  const now =
    counts && counts.votes > 0
      ? `Şu an ${counts.votes.toLocaleString("tr-TR")} doğrulanmış taraftar${counts.rank ? `, Türkiye ${counts.rank}.` : ""}`
      : "Sayım yeni başladı";
  const description = `${team.name} kaç taraftarı var? ${now}. ${leagueName} taraftar sıralaması ve ${team.name} taraftarlarının illere göre dağılımı.`;
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
