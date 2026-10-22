import { OG_SIZE, renderShareCard } from "@/lib/og-card";
import { teamCounts, totalVerified } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bizim Tribün taraftar sayımı";

export default async function Image() {
  const total = await totalVerified();
  const teams = (await teamCounts())
    .filter((t) => t.votes > 0)
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "tr"));
  const lines = teams.length
    ? teams
        .slice(0, 3)
        // Equal votes share a rank.
        .map((t) => `${1 + teams.filter((o) => o.votes > t.votes).length}. ${t.name}: ${t.votes.toLocaleString("tr-TR")}`)
    : ["Sayım yeni başladı. İlk doğrulanmış taraftar sen ol."];
  return renderShareCard({
    eyebrow: "Türkiye taraftar sayımı",
    title: "En büyük kim?",
    stat: total.toLocaleString("tr-TR"),
    statLabel: "doğrulanmış taraftar",
    lines,
  });
}
