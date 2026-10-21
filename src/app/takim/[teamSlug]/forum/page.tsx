"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ForumBoardView from "@/components/forum/ForumBoardView";
import TeamMark from "@/components/TeamMark";
import { useAuth } from "@/components/AuthProvider";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import { tribunTitle } from "@/lib/forum-category";
import { isStaffRole } from "@/lib/permissions";

type LeaderRow = {
  weekStart: string;
  period: string;
  username: string;
  activeDays: number;
  likeCount: number;
};

export default function TeamForumPage() {
  const rawSlug = useParams<{ teamSlug: string }>().teamSlug;
  const teamSlug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || "";
  const catalog = useTeamCatalog();
  const team = catalog.getTeam(teamSlug);
  const active = Boolean(team?.isForumActive);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const { user } = useAuth();
  // Leaders are only listed to those who may read this tribune.
  const canRead = Boolean(
    user && team && (isStaffRole(user.role) || user.voteTeamId === team.id),
  );

  useEffect(() => {
    if (!active || !canRead) return;
    let cancelled = false;
    void fetch(`/api/forum/teams/${teamSlug}/leaders?limit=4`, { cache: "no-store" })
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
  }, [active, canRead, teamSlug]);

  return (
    <ForumBoardView
      apiPath={`/api/forum/teams/${teamSlug}/topics`}
      newTopicPath={`/takim/${teamSlug}/forum/yeni`}
      backHref="/takimlar"
      backLabel="Takım tribünleri"
      active={Boolean(team && active)}
      teamId={team?.id ?? teamSlug}
      gateTitle={team ? tribunTitle(team.name) : undefined}
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
                <p className="font-mono text-[12px] opacity-70 mt-1">
                  {catalog.leagueLabel(team.league)} • {total} konu •{" "}
                  <Link href={`/takim/${team.id}`} className="underline underline-offset-4 inline-flex min-h-10 items-center">
                    taraftar sayımı
                  </Link>
                </p>
              </div>
            </div>
            {leaders.length > 0 ? (
              <div className="mt-4 border-[3px] border-black bg-white p-3">
                <p className="font-anton text-[15px]">HAFTANIN TARAFTARLARI</p>
                <p className="font-mono text-[11px] opacity-70">
                  Her hafta en çok günde yazan ve beğeni alan taraftar seçilir. Bir hafta boyunca adının
                  yanında meşale taşır.
                </p>
                <ul className="mt-1 font-mono text-[12px] space-y-0.5">
                  {leaders.map((row) => (
                    <li key={row.weekStart}>
                      {row.period} — {row.username.startsWith("silinmis_") ? "Silinmiş üye" : row.username} ({row.activeDays} aktif gün • {row.likeCount} beğeni)
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
