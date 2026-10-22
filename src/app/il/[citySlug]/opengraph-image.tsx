import { getCityBySlug } from "@/lib/cities";
import { cityVoteTotals } from "@/lib/city-stats";
import { OG_SIZE, renderShareCard, shareCardOrFallback } from "@/lib/og-card";

export const dynamic = "force-dynamic";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bizim Tribün il sayımı";

export default function Image({ params }: { params: Promise<{ citySlug: string }> }) {
  return shareCardOrFallback(() => draw(params));
}

async function draw(params: Promise<{ citySlug: string }>) {
  const { citySlug } = await params;
  const city = getCityBySlug(citySlug);
  if (!city) return renderShareCard({ eyebrow: "Bizim Tribün", title: "İl bulunamadı" });
  const { total, rows } = await cityVoteTotals(city.name);
  const top = rows[0];
  const leaders = top ? rows.filter((r) => r.votes === top.votes) : [];
  const lines =
    total === 0
      ? ["Bu ilde henüz doğrulanmış oy yok."]
      : [
          leaders.length > 1
            ? `Liderlik eşit: ${leaders.map((r) => r.name).join(", ")} (${top!.votes.toLocaleString("tr-TR")} oy)`
            : `Lider: ${top!.name} (%${top!.percent})`,
          ...rows
            .filter((r) => !leaders.includes(r))
            .slice(0, 2)
            .map((r) => `${r.name}: %${r.percent}`),
        ];
  return renderShareCard({
    eyebrow: "İl sayımı",
    title: city.name,
    stat: total.toLocaleString("tr-TR"),
    statLabel: "doğrulanmış oy",
    lines,
  });
}
