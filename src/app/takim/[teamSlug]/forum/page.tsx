"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ForumBoardView from "@/components/forum/ForumBoardView";
import TeamMark from "@/components/TeamMark";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import { tribunTitle } from "@/lib/forum-category";

type LeaderRow = {
  period: string;
  username: string;
  postCount: number;
};

export default function TeamForumPage() {
  const rawSlug = useParams<{ teamSlug: string }>().teamSlug;
  const teamSlug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || "";
  const catalog = useTeamCatalog();
  const team = catalog.getTeam(teamSlug);
  const active = Boolean(team?.isForumActive);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetch(`/api/forum/teams/${teamSlug}/leaders?limit=6`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        setLeaders(data.leaders ?? []);
      })
      .catch(() => {
        if (!cancelled) setLeaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, teamSlug]);

  return (
    <ForumBoardView
      apiPath={`/api/forum/teams/${teamSlug}/topics`}
      newTopicPath={`/takim/${teamSlug}/forum/yeni`}
      backHref="/takimlar"
      backLabel="Tüm tribünler"
      active={Boolean(team && active)}
      closedBody="Bu takımda henüz tribün açılmadı."
      header={(total) =>
        team ? (
          <>
            <div className="mt-3 flex items-start gap-3">
              <TeamMark team={team} size={56} />
              <div className="min-w-0">
                <h1 className="font-anton text-[32px] sm:text-[42px] leading-[0.85]">
                  {tribunTitle(team.name)}
                </h1>
                <p className="font-mono text-[11px] opacity-60 mt-1">
                  {catalog.leagueLabel(team.league)} • {total} konu
                </p>
              </div>
            </div>
            {leaders.length > 0 ? (
              <div className="mt-4 border-[3px] border-black bg-white p-3">
                <p className="font-anton text-[13px]">TRİBÜN LİDERLERİ</p>
                <ul className="mt-1 font-mono text-[11px] space-y-0.5">
                  {leaders.map((row) => (
                    <li key={`${row.period}-${row.username}`}>
                      {row.period} — {row.username} ({row.postCount} yazı)
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null
      }
    />
  );
}
