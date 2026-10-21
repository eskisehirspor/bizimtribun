import { renderShareCard, OG_SIZE } from "@/lib/og-card";
import { teamSummary } from "@/lib/stats";
import { getCatalogTeam, leagueLabels } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bizim Tribün takım sayımı";

export default async function Image({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const team = getCatalogTeam(teamSlug);
  if (!team) return renderShareCard({ eyebrow: "Bizim Tribün", title: "Takım bulunamadı" });
  const s = teamSummary(team.id);
  const league = leagueLabels()[team.league] ?? team.league;
  const lines: string[] = [];
  if (s?.rank) lines.push(`Türkiye sırası: ${s.rank}.${s.tiedWith ? " (eşit)" : ""} • ${league}: ${s.leagueRank}.`);
  if (s?.topProvinces[0]) lines.push(`En güçlü il: ${s.topProvinces[0].province} (${s.topProvinces[0].votes.toLocaleString("tr-TR")})`);
  return renderShareCard({
    eyebrow: `${league} • ${team.city}`,
    title: team.name,
    stat: (s?.votes ?? 0).toLocaleString("tr-TR"),
    statLabel: "doğrulanmış taraftar",
    lines: lines.length ? lines : ["Henüz doğrulanmış taraftar yok."],
    band: [team.bleed, team.accent],
  });
}
