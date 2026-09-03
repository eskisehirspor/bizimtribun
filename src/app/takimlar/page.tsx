"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import { FORUM_ACTIVE_TEAM_IDS, LEAGUE_LABEL, getTeam } from "@/lib/teams";
import { formatForumDate } from "@/lib/forum-ui";

type Preview = {
  total: number;
  lastTitle: string | null;
  lastAt: string | null;
};

export default function TakimlarPage() {
  const [previews, setPreviews] = useState<Record<string, Preview>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      FORUM_ACTIVE_TEAM_IDS.map(async (id) => {
        try {
          const res = await fetch(`/api/forum/teams/${id}/topics?limit=1&page=1`, {
            cache: "no-store",
          });
          const data = await res.json();
          if (!res.ok) return [id, { total: 0, lastTitle: null, lastAt: null }] as const;
          const first = data.topics?.[0];
          return [
            id,
            {
              total: data.total ?? 0,
              lastTitle: first?.title ?? null,
              lastAt: first?.updatedAt ?? first?.createdAt ?? null,
            },
          ] as const;
        } catch {
          return [id, { total: 0, lastTitle: null, lastAt: null }] as const;
        }
      }),
    ).then((rows) => {
      if (cancelled) return;
      setPreviews(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ForumShell>
      <p className="font-mono text-[10px] tracking-[0.16em]">BİZİM TRİBÜN • TRİBÜN</p>
      <h1 className="font-anton text-[40px] sm:text-[52px] leading-[0.85] mt-2">
        TAKIM
        <br />
        <span className="bg-black text-[#FFEA00] px-2 inline-block rotate-[-1deg]">
          TRİBÜNLERİ
        </span>
      </h1>
      <p className="font-mono text-[13px] mt-3 max-w-[520px]">
        25 tribün. Gündem, deplasman, tartışma, anılar. Küfürsüz, net, taraftar usulü.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FORUM_ACTIVE_TEAM_IDS.map((id) => {
          const team = getTeam(id);
          if (!team) return null;
          const preview = previews[id];
          return (
            <Link
              key={id}
              href={`/takim/${id}/forum`}
              className="flex gap-3 items-center border-[3px] border-black bg-[#FFFEFA] p-3 shadow-[4px_4px_0_black]"
            >
              <TeamMark team={team} size={52} />
              <div className="min-w-0 flex-1">
                <div className="font-anton text-[18px] leading-tight truncate">
                  {team.name} Tribünü
                </div>
                <div className="font-mono text-[10px] opacity-60 mt-0.5">
                  {LEAGUE_LABEL[team.league]} • {preview ? `${preview.total} konu` : "…"}
                </div>
                <div className="font-mono text-[11px] mt-1 truncate">
                  {preview?.lastTitle
                    ? `${preview.lastTitle}${preview.lastAt ? ` · ${formatForumDate(preview.lastAt)}` : ""}`
                    : preview
                      ? "Henüz konu yok"
                      : "Yükleniyor"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="font-mono text-[11px] mt-6 opacity-60">
        Takımını bulamadın mı?{" "}
        <Link href="/takim-talep" className="underline">
          Yeni takım talep et
        </Link>
      </p>
    </ForumShell>
  );
}
