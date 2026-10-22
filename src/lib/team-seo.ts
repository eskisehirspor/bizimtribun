import type { Metadata } from "next";
import { appUrl } from "./request";
import type { CatalogTeam } from "./team-catalog";

export function teamCanonical(id: string) {
  return `${appUrl().replace(/\/$/, "")}/takim/${id}`;
}

/** "Galatasaray" -> "Galatasaraylı", "Fenerbahçe" -> "Fenerbahçeli", "Trabzonspor" -> "Trabzonsporlu". */
export function fanForm(name: string) {
  const lastVowel = [...name.toLocaleLowerCase("tr")].reverse().find((ch) => "aeıioöuü".includes(ch)) ?? "a";
  const suffix = "aı".includes(lastVowel) ? "lı" : "ei".includes(lastVowel) ? "li" : "ou".includes(lastVowel) ? "lu" : "lü";
  return `${name}${suffix}`;
}

/** The year people type into searches ("taraftar sayısı 2026"), in Turkish time. */
export function seoYear(now = new Date()) {
  return now.toLocaleDateString("tr-TR", { year: "numeric", timeZone: "Europe/Istanbul" });
}

/**
 * Matches searches like "Galatasaray taraftar sayısı 2026", "kaç kişi Galatasaraylı",
 * "Eskişehirspor kaç taraftarı var", and quotes the live count.
 */
export function teamPageMetadata(
  team: CatalogTeam,
  leagueName: string,
  counts?: { votes: number; rank: number | null } | null,
): Metadata {
  const fan = fanForm(team.name);
  // Google shows the site name on its own, so the brand stays out of the title.
  const title = { absolute: `${team.name} Taraftar Sayısı ${seoYear()}: Kaç Kişi ${fan}?` };
  const now =
    counts && counts.votes > 0
      ? `Şu an ${counts.votes.toLocaleString("tr-TR")} doğrulanmış ${fan}${counts.rank ? `, Türkiye ${counts.rank}.` : ""}`
      : "Sayım yeni başladı";
  const description = `${team.name} kaç taraftarı var, Türkiye'de kaç ${fan} var? ${now}. ${team.name} taraftarlarının illere göre dağılımı ve ${leagueName} sıralaması.`;
  const url = teamCanonical(team.id);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: title.absolute, description, url, locale: "tr_TR", type: "website", siteName: "Bizim Tribün" },
    twitter: { card: "summary_large_image", title: title.absolute, description },
  };
}
