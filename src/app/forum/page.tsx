import type { Metadata } from "next";
import Link from "next/link";
import ForumShell from "@/components/ForumShell";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tribün | Bizim Tribün",
  description: "Genel Tribün ve takım tribünleri.",
};

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
        Genel Tribün herkese açık. Takım tribünlerine yalnızca o takıma oy veren taraftarlar
        girebilir.
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
    </ForumShell>
  );
}
