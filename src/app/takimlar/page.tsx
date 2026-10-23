"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import BackLink from "@/components/BackLink";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import { btnAccent, btnPrimary } from "@/components/ui";
import { useTeamCatalog, type ClientCatalogTeam } from "@/components/useTeamCatalog";
import { tribunTitle } from "@/lib/forum-category";
import { formatForumDate } from "@/lib/forum-ui";

type Preview = {
  teamId: string;
  total: number;
  lastTitle: string | null;
  lastAt: string | null;
};

type Summary = { myTeamId: string | null; staff: boolean; boards: Preview[] };

export default function TakimlarPage() {
  const { user, loading } = useAuth();
  const { forumTeams, leagueLabel } = useTeamCatalog();
  const [summary, setSummary] = useState<Summary | null>(null);
  const viewerId = user?.id ?? null;

  // One request: counts only for the tribunes this viewer may read.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    fetch("/api/forum/boards/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setSummary(
          d ? { myTeamId: d.myTeamId ?? null, staff: Boolean(d.staff), boards: d.boards ?? [] } : { myTeamId: null, staff: false, boards: [] },
        );
      })
      .catch(() => {
        if (!cancelled) setSummary({ myTeamId: null, staff: false, boards: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [loading, viewerId]);

  const myTeamId = summary?.myTeamId ?? user?.voteTeamId ?? null;
  const staff = Boolean(summary?.staff);
  const previews = useMemo(
    () => new Map((summary?.boards ?? []).map((b) => [b.teamId, b])),
    [summary],
  );
  const mine = forumTeams.find((t) => t.id === myTeamId);
  const others = forumTeams.filter((t) => t.id !== myTeamId);

  return (
    <ForumShell>
      <BackLink href="/forum">Tüm tribünler</BackLink>
      <p className="font-mono text-[11px] tracking-[0.16em] mt-3">BİZİM TRİBÜN • TRİBÜN</p>
      <h1 className="font-anton text-[40px] sm:text-[52px] leading-[1.05] mt-2">
        TAKIM
        <br />
        <span className="bg-black text-[#FFEA00] px-2 inline-block rotate-[-1deg]">
          TRİBÜNLERİ
        </span>
      </h1>
      <p className="font-mono text-[14px] mt-3 max-w-[560px]">
        {forumTeams.length} tribün. Bir takıma dokun: kaç taraftarı var, Türkiye&apos;de kaçıncı, en çok
        hangi illerde tutuluyor. Her takım tribünü yalnızca o takıma oy veren taraftarlara açık: gündem,
        deplasman, maç günü, anılar.
      </p>

      {!loading && !user && (
        <div className="mt-5 border-[3px] border-black bg-[#FFEA00] p-4 flex flex-wrap items-center gap-3">
          <p className="font-mono text-[14px] flex-1 min-w-[200px]">
            Takımının tribününe girmek için giriş yap.
          </p>
          <Link href="/giris?next=/takimlar" className={btnPrimary}>
            GİRİŞ YAP
          </Link>
        </div>
      )}
      {!loading && user && !myTeamId && !staff && (
        <div className="mt-5 border-[3px] border-black bg-[#FFEA00] p-4 flex flex-wrap items-center gap-3">
          <p className="font-mono text-[14px] flex-1 min-w-[200px]">
            Takımını seçince o takımın tribünü sana açılır.
          </p>
          <Link href="/takim-sec" className={btnPrimary}>
            TAKIMINI SEÇ
          </Link>
        </div>
      )}

      {mine && (
        <section className="mt-6" aria-labelledby="senin-tribunun">
          <h2 id="senin-tribunun" className="font-anton text-[22px]">
            SENİN TRİBÜNÜN
          </h2>
          <div className="mt-2">
            <OpenCard team={mine} preview={previews.get(mine.id)} ready={Boolean(summary)} league={leagueLabel(mine.league)} highlight />
          </div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="diger-tribunler">
        <h2 id="diger-tribunler" className="font-anton text-[22px]">
          {mine ? "DİĞER TAKIM TRİBÜNLERİ" : "TÜM TAKIM TRİBÜNLERİ"}
        </h2>
        {staff && (
          <p className="font-mono text-[12px] opacity-70">
            Yetkili olarak tüm tribünleri okuyabilirsin; yalnızca kendi takımının tribününe yazabilirsin.
          </p>
        )}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {others.map((team) =>
            staff ? (
              <OpenCard key={team.id} team={team} preview={previews.get(team.id)} ready={Boolean(summary)} league={leagueLabel(team.league)} />
            ) : (
              <LockedCard key={team.id} team={team} league={leagueLabel(team.league)} />
            ),
          )}
        </div>
      </section>

      <div className="mt-8 border-[3px] border-dashed border-black p-4 flex flex-wrap items-center gap-3">
        <p className="font-mono text-[14px] flex-1 min-w-[200px]">Takımını bulamadın mı?</p>
        <Link href="/takim-talep" className={btnAccent}>
          YENİ TAKIM TALEP ET
        </Link>
      </div>
    </ForumShell>
  );
}

function OpenCard({
  team,
  preview,
  ready,
  league,
  highlight = false,
}: {
  team: ClientCatalogTeam;
  preview: Preview | undefined;
  ready: boolean;
  league: string;
  highlight?: boolean;
}) {
  const total = preview?.total ?? 0;
  return (
    <Link
      href={`/takim/${team.id}/forum`}
      className={`flex gap-3 items-center border-[3px] border-black p-3 min-h-[84px] shadow-[4px_4px_0_black] hover:-translate-y-[1px] ${
        highlight ? "bg-[#FFEA00]" : "bg-[#FFFEFA]"
      }`}
    >
      <TeamMark team={team} size={52} />
      <div className="min-w-0 flex-1">
        <div className="font-anton text-[18px] leading-tight truncate">{tribunTitle(team.name)}</div>
        <div className="font-mono text-[12px] opacity-70 mt-0.5">
          {league} • {ready ? `${total} konu` : "yükleniyor…"}
        </div>
        <div className="font-mono text-[12px] mt-1 truncate">
          {preview?.lastTitle
            ? `${preview.lastTitle}${preview.lastAt ? ` · ${formatForumDate(preview.lastAt)}` : ""}`
            : ready
              ? "Henüz konu yok. İlk konuyu sen aç."
              : ""}
        </div>
      </div>
      <span aria-hidden="true" className="font-anton text-[22px]">
        →
      </span>
    </Link>
  );
}

function LockedCard({ team, league }: { team: ClientCatalogTeam; league: string }) {
  return (
    <Link
      href={`/takim/${team.id}`}
      className="flex gap-3 items-center border-[3px] border-black bg-[#FFFEFA]/70 p-3 min-h-[84px]"
      aria-label={`${team.name}: tribün yalnızca taraftarlarına açık. Takım sayfasını aç.`}
    >
      <span className="opacity-60">
        <TeamMark team={team} size={52} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-anton text-[18px] leading-tight truncate">{tribunTitle(team.name)}</div>
        <div className="font-mono text-[12px] opacity-70 mt-0.5">{league}</div>
        <div className="font-mono text-[12px] mt-1">🔒 Yalnızca {team.name} taraftarları</div>
      </div>
    </Link>
  );
}
