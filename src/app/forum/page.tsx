import type { Metadata } from "next";
import Link from "next/link";
import ForumShell from "@/components/ForumShell";
import { CITIES } from "@/lib/cities";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tribün | Bizim Tribün",
  description: "Genel Tribün, takım tribünleri ve 81 il tribünü.",
};

function boardCounts() {
  const rows = getDb()
    .prepare(
      `SELECT board, city, COUNT(*) as c FROM forum_topics
       WHERE deleted_at IS NULL AND held_at IS NULL AND board IN ('general', 'city')
       GROUP BY board, city`,
    )
    .all() as { board: string; city: string | null; c: number }[];
  const general = rows.find((r) => r.board === "general")?.c ?? 0;
  const cities = new Map(rows.filter((r) => r.board === "city").map((r) => [r.city!, r.c]));
  return { general, cities };
}

export default function ForumIndexPage() {
  const { general, cities } = boardCounts();
  return (
    <ForumShell>
      <p className="font-mono text-[11px] tracking-[0.16em]">BİZİM TRİBÜN • TRİBÜN</p>
      <h1 className="font-anton text-[40px] sm:text-[52px] leading-[0.85] mt-2">TRİBÜN</h1>
      <p className="font-mono text-[14px] mt-3 max-w-[60ch]">
        Genel Tribün ve il tribünleri herkese açık. Takım tribünlerine yalnızca o takıma oy veren
        taraftarlar girebilir.
      </p>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <Link
          href="/forum/genel"
          className="border-[4px] border-black bg-[#FFEA00] p-4 shadow-[6px_6px_0_black]"
        >
          <p className="font-anton text-[26px] leading-none">GENEL TRİBÜN</p>
          <p className="font-mono text-[13px] mt-2">Takım ayırmadan futbol. Herkese açık. {general} konu.</p>
        </Link>
        <Link
          href="/takimlar"
          className="border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[6px_6px_0_black]"
        >
          <p className="font-anton text-[26px] leading-none">TAKIM TRİBÜNLERİ</p>
          <p className="font-mono text-[13px] mt-2">Her kulübün kendi tribünü. 🔒 Yalnızca o takımın taraftarları girer.</p>
        </Link>
      </div>
      <h2 className="font-anton text-[26px] mt-8">İL TRİBÜNLERİ</h2>
      <p className="font-mono text-[13px] opacity-70">
        Herkese açık. Konumun kullanılmaz; istediğin ilin tribününe yazabilirsin.
      </p>
      <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
        {CITIES.map((city) => (
          <li key={city.slug}>
            <Link
              href={`/forum/il/${city.slug}`}
              className="flex min-h-11 items-center justify-between gap-2 border-[2px] border-black bg-[#FFFEFA] px-2 py-1 font-mono text-[13px] hover:bg-[#FFEA00]/40"
            >
              <span className="truncate">{city.name}</span>
              <span className="opacity-60 tabular-nums" aria-label={`${cities.get(city.name) ?? 0} konu`}>{cities.get(city.name) ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ForumShell>
  );
}
