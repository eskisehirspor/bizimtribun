"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { RecentTopic } from "@/lib/home-feed";
import {
  LEAGUE_LABEL,
  LEAGUE_ORDER,
  foldTr,
  getTeam,
  type LeagueId,
  type Team,
} from "@/lib/teams";
import PitchDecor from "@/components/PitchDecor";
import TurkeyMap from "@/components/TurkeyMap";
import TeamColors from "@/components/TeamColors";

type TeamStat = Team & { votes: number };
type CityLeader = { teamId: string; votes: number; tied: boolean; coLeaderIds: string[] };
type CityStanding = { teamId: string; votes: number };

type Props = {
  initialTeams: TeamStat[];
  initialTotal: number;
  initialCities: Record<string, CityLeader>;
  initialStandings: Record<string, CityStanding[]>;
  recentTopics: RecentTopic[];
  generatedAt: string;
};

export default function HomeClient({
  initialTeams,
  initialTotal,
  initialCities,
  initialStandings,
  recentTopics,
  generatedAt,
}: Props) {
  const { user } = useAuth();
  const [teams, setTeams] = useState(initialTeams);
  const [total, setTotal] = useState(initialTotal);
  const [cities, setCities] = useState(initialCities);
  const [standings, setStandings] = useState(initialStandings);
  const [asOf, setAsOf] = useState(generatedAt);
  const [league, setLeague] = useState<"all" | LeagueId>("super");
  const [query, setQuery] = useState("");
  const preview = { teams, total, cities, standings };
  const myTeamId = user?.voteTeamId ?? null;

  const ranked = useMemo(
    () =>
      [...preview.teams].sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        const leagueDiff =
          LEAGUE_ORDER.indexOf(a.league) - LEAGUE_ORDER.indexOf(b.league);
        if (leagueDiff) return leagueDiff;
        return a.name.localeCompare(b.name, "tr");
      }),
    [preview.teams],
  );
  const leader = preview.total > 0 ? ranked[0] : undefined;

  const filtered = useMemo(() => {
    const q = foldTr(query.trim());
    return ranked.filter((t) => {
      if (league !== "all" && t.league !== league) return false;
      if (!q) return true;
      return (
        foldTr(t.name).includes(q) ||
        foldTr(t.city).includes(q) ||
        foldTr(t.short).includes(q)
      );
    });
  }, [ranked, league, query]);

  async function refresh() {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTeams(data.teams);
      setTotal(data.total);
      setCities(data.cities);
      setStandings(data.standings);
      if (data.generatedAt) setAsOf(data.generatedAt);
    } catch {
      /* keep the last good numbers */
    }
  }

  function teamAction(teamId: string) {
    if (myTeamId) return null;
    if (!user) return `/uye-ol?takim=${encodeURIComponent(teamId)}`;
    return `/takim-sec?takim=${encodeURIComponent(teamId)}`;
  }

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.22] mix-blend-multiply paper-bg" />
      <PitchDecor />

      <header className="relative z-20 border-b-[4px] border-black bg-[#FFFEFA]">
        <div className="absolute top-0 left-0 w-full h-[6px] bg-[repeating-linear-gradient(90deg,black_0_20px,#FFEA00_20px_40px)]" />
        <div className="max-w-[1320px] mx-auto px-4 sm:px-5 md:px-8 pt-8 pb-5 md:py-8">
          <div className="font-mono text-[9px] sm:text-[10px] tracking-[0.08em] sm:tracking-[0.16em] leading-tight mb-5 md:mb-4">
            81 İL • {teams.length} TAKIM • VERİ:{" "}
            {new Date(asOf).toLocaleString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto] items-start md:items-end gap-x-3 gap-y-2 md:gap-x-6">
            <h1 className="font-anton text-[40px] sm:text-[48px] md:text-[68px] leading-[0.82] tracking-tighter">
              BİZİM
              <br />
              <span className="bg-black text-[#FFEA00] px-2 inline-block rotate-[-1deg]">
                TRİBÜN
              </span>
            </h1>
            <p className="col-start-1 md:col-start-2 font-ultras text-[18px] sm:text-[22px] md:text-[32px] tracking-wide -rotate-2 md:-rotate-[1.2deg] origin-left leading-[1.05] md:mb-2">
              Türkiye&apos;nin en gürültülü gerçek sayımı!
            </p>
            <div className="col-start-2 row-start-1 row-span-2 md:col-start-3 md:row-span-1 md:row-start-1 shrink-0 border-[3px] md:border-[4px] border-black bg-[#FFEA00] px-2.5 py-2 sm:p-3 md:p-4 shadow-[4px_4px_0_black] md:shadow-[6px_6px_0_black] rotate-1 md:-rotate-2 self-start md:self-end w-[112px] sm:w-[140px] md:w-auto mr-3 sm:mr-4 md:mr-1">
              <div className="font-mono text-[8px] sm:text-[9px] md:text-[10px] leading-tight">
                DOĞRULANMIŞ
                <br className="md:hidden" />
                <span className="hidden md:inline"> </span>
                TARAFTAR
              </div>
              <div className="font-anton text-[28px] sm:text-[34px] md:text-[38px] leading-none tabular-nums mt-1">
                {preview.total.toLocaleString("tr-TR")}
              </div>
              <div className="font-mono text-[8px] sm:text-[9px] md:text-[10px] mt-1 leading-tight">
                KİM ÖNDE?
                <br className="md:hidden" />
                <span className="hidden md:inline"> </span>
                {leader?.name ?? "henüz yok"}
              </div>
            </div>
          </div>
        </div>
        <div className="border-t-[3px] border-black overflow-hidden bg-black text-[#FFEA00] font-anton text-[14px] py-1">
          <div className="flex w-max whitespace-nowrap animate-[marquee_70s_linear_infinite]">
            {Array.from({ length: 2 }).map((_, copy) => (
              <span key={copy} className="shrink-0" aria-hidden={copy === 1}>
                {Array.from({ length: 8 })
                  .map(
                    () =>
                      "81 İL 81 TARAFTAR • TAKIMININ SESİNİ DUYUR • KİM DAHA BÜYÜK?",
                  )
                  .join(" • ")}
                {" • "}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-6 py-6 grid grid-cols-12 gap-6 md:gap-8">
        <div className="col-span-12 border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[8px_8px_0_black]">
          <h2 className="font-anton text-[32px] md:text-[48px] leading-[0.85] tracking-tight mb-8 md:mb-10">
            TÜRKİYE HARİTASI
            <br />
            <span className="mt-2 inline-block bg-black text-[#FFEA00] px-3 py-1 rotate-[-1deg] text-[26px] md:text-[36px]">
              İL LİDERLERİ
            </span>
          </h2>
          <TurkeyMap leaders={preview.cities} standings={preview.standings} />
        </div>

        <section className="col-span-12 lg:col-span-8 space-y-6">
          <div className="border-[4px] border-black bg-[#FFFEFA] p-4 md:p-5 shadow-[8px_8px_0_black]">
            <div className="flex justify-between items-baseline flex-wrap gap-2">
              <h2 className="font-anton text-[28px] md:text-[36px] leading-[0.9]">
                TAKIMINI{" "}
                <span className="bg-[#C8102E] text-white px-2 inline-block rotate-1">
                  SEÇ
                </span>
              </h2>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLeague("all")}
                className={`font-anton text-[13px] px-3 py-1 border-[3px] border-black ${
                  league === "all" ? "bg-black text-[#FFEA00]" : "bg-white"
                }`}
              >
                TÜMÜ
              </button>
              {LEAGUE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLeague(id)}
                  className={`font-anton text-[13px] px-3 py-1 border-[3px] border-black ${
                    league === id ? "bg-black text-[#FFEA00]" : "bg-white"
                  }`}
                >
                  {LEAGUE_LABEL[id].toLocaleUpperCase("tr")}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Takım, il veya kısaltma ara…"
              className="mt-3 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none bg-white"
            />
            <div className="mt-2 font-mono text-[10px] opacity-70">
              {filtered.length} takım{" "}
              <button type="button" onClick={() => void refresh()} className="underline ml-2">
                sayıları yenile
              </button>
            </div>

            <div className="mt-3 max-h-[420px] overflow-auto border-[3px] border-black divide-y-[2px] divide-black">
              {filtered.map((team) => {
                return (
                  <div
                    key={team.id}
                    className="flex flex-wrap items-center gap-3 p-2 md:p-3 bg-white"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <span className="font-anton text-[16px] leading-none">
                          {team.name}
                        </span>
                        <TeamColors team={team} />
                      </div>
                      <div className="font-mono text-[10px] mt-1">
                        {LEAGUE_LABEL[team.league]} • {team.city}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-anton text-[18px] tabular-nums leading-none">
                        {team.votes.toLocaleString("tr-TR")}
                      </div>
                    </div>
                    {myTeamId === team.id ? (
                      <span className="font-anton text-[13px] px-3 py-2 border-[3px] border-black bg-[#FFEA00]">
                        SENİN TAKIMIN
                      </span>
                    ) : teamAction(team.id) ? (
                      <Link
                        href={teamAction(team.id)!}
                        className="font-anton text-[14px] px-3 py-2 border-[3px] border-black bg-black text-white shadow-[3px_3px_0_black] hover:translate-x-[1px] hover:translate-y-[1px]"
                      >
                        Takımım!
                      </Link>
                    ) : null}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-4 font-mono text-[12px]">Eşleşme yok. Filtreyi gevşet.</div>
              )}
            </div>
          </div>

          <div className="border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[6px_6px_0_black] rotate-[0.3deg]">
            <h3 className="font-anton text-[26px]">NASIL ÇALIŞIR?</h3>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              {[
                {
                  t: "1. SMS İLE DOĞRULA",
                  d: "Cep telefonuna gelen kodla hesabını aç. Her telefon numarası tek hesap açabilir.",
                },
                {
                  t: "2. TAKIMINI BİR KEZ SEÇ",
                  d: "Seçimin kalıcıdır, sonradan değiştirilemez. Sayaçlar yalnızca bu seçimlerden hesaplanır.",
                },
              ].map((m) => (
                <div key={m.t} className="border-[3px] border-black p-3 relative">
                  <div className="font-anton text-[14px] leading-tight">{m.t}</div>
                  <div className="font-mono text-[11px] mt-2 leading-[1.3]">{m.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="relative border-[4px] border-black bg-[#0F0F0F] text-[#F2EFE6] shadow-[8px_8px_0_black] p-4 pb-5">
            <div className="flex justify-between items-center gap-2">
              <h3 className="font-anton text-[24px] tracking-wide">GENEL TÜRKİYE</h3>
              <span className="font-marker text-[13px] bg-[#FFEA00] text-black px-2 rotate-2">
                TABLO
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] opacity-60">
              {preview.total.toLocaleString("tr-TR")} doğrulanmış taraftar • eşit oyda
              alfabetik
            </div>
            <div className="mt-3 max-h-[420px] overflow-auto space-y-1 pr-1">
              {ranked.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 border-b border-dashed border-white/20 pb-1.5"
                >
                  <span className="font-anton text-[15px] w-[26px] opacity-80">{i + 1}.</span>
                  <span className="font-anton text-[13px] flex-1 leading-tight inline-flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{m.name}</span>
                    <TeamColors team={m} size={10} />
                  </span>
                  <span className="font-mono text-[9px] opacity-50 w-[72px] text-right shrink-0">
                    {LEAGUE_LABEL[m.league]}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums w-[28px] text-right shrink-0">
                    {m.votes.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-[4px] border-black bg-white p-4 shadow-[5px_5px_0_black]">
            <h3 className="font-anton text-[22px]">FORUMDA SON KONULAR</h3>
            <div className="mt-3 space-y-2">
              {recentTopics.length === 0 && (
                <p className="font-mono text-[11px]">
                  Henüz konu açılmadı. İlk konuyu sen aç.
                </p>
              )}
              {recentTopics.map((row) => {
                const team = getTeam(row.teamId);
                return (
                  <Link
                    key={row.id}
                    href={`/forum/konu/${row.id}`}
                    className="flex items-center gap-2 font-mono text-[11px] md:text-[12px] border-b border-dashed border-black/20 pb-1.5 hover:bg-[#FFEA00]/40"
                  >
                    {team && <TeamColors team={team} size={10} />}
                    <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    <span className="shrink-0 opacity-60">@{row.authorUsername}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </main>

      <footer className="relative z-10 border-t-[4px] border-black">
        <div className="h-8 pitch-foot border-b-[4px] border-black" />
        <div className="bg-[#111] text-[#F2EFE6] px-4 md:px-6 py-6">
          <div className="max-w-[1320px] mx-auto flex flex-wrap justify-between gap-4">
            <div>
              <div className="font-anton text-[28px]">MANİFESTO — BODRUM KAT</div>
              <p className="font-mono text-[12px] max-w-[640px] mt-2 opacity-80">
                Takımının gerçek gücünü Bizim Tribün&apos;de göster. Sen varsan +1 kişi
                fazlayız. Haydi katıl!
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px] h-fit">
              <Link href="/takimlar" className="border border-white/30 px-2 py-1">
                Takım tribünleri
              </Link>
              <Link href="/kvkk" className="border border-white/30 px-2 py-1">
                KVKK aydınlatma
              </Link>
              <Link href="/sil-verilerim" className="border border-white/30 px-2 py-1">
                Verilerimi sil
              </Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
