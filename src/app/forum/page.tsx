import Link from "next/link";
import { MilliPanel } from "@/components/AyYildiz";
import ForumShell from "@/components/ForumShell";
import { getDb } from "@/lib/db";
import { NATIONAL_BOARD_PATH, NATIONAL_BOARD_TITLE } from "@/lib/national-board";
import { publicPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Tribün: Taraftar Forumu | Bizim Tribün",
  description:
    "Her takımın taraftarlarına özel tribünü ve herkese açık Milli Takım Tribünü. Doğrulanmış taraftarlarla futbol konuş.",
  path: "/forum",
});

function boardCounts() {
  const rows = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM forum_topics
       WHERE deleted_at IS NULL AND held_at IS NULL AND board = 'general'`,
    )
    .get() as { c: number };
  return { general: rows.c };
}

export default function ForumIndexPage() {
  const { general } = boardCounts();
  return (
    <ForumShell>
      <p className="font-mono text-[11px] tracking-[0.16em]">BİZİM TRİBÜN • TRİBÜN</p>
      <h1 className="font-anton text-[40px] sm:text-[52px] leading-[0.85] mt-2">TRİBÜN</h1>
      <p className="font-mono text-[14px] mt-3 max-w-[60ch]">
        Her takımın kendi tribünü var. Takım tribünlerine yalnızca o takıma oy veren taraftarlar
        girebilir. Milli Takım Tribünü herkese açık.
      </p>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <Link
          href="/takimlar"
          className="border-[4px] border-black bg-[#FFEA00] p-4 shadow-[6px_6px_0_black]"
        >
          <p className="font-anton text-[26px] leading-none">TAKIM TRİBÜNLERİ</p>
          <p className="font-mono text-[13px] mt-2">Her kulübün kendi tribünü. 🔒 Yalnızca o takımın taraftarları girer.</p>
        </Link>
        <Link href={NATIONAL_BOARD_PATH} className="block">
          <MilliPanel className="h-full p-4 pb-6">
            <p className="font-anton text-[26px] leading-none">{NATIONAL_BOARD_TITLE}</p>
            <p className="font-mono text-[13px] mt-2 max-w-[34ch]">
              Ay yıldızlılar ve takım ayırmadan futbol. Herkese açık. {general} konu.
            </p>
          </MilliPanel>
        </Link>
      </div>
    </ForumShell>
  );
}
