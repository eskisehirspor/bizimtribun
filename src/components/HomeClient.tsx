"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { RecentTopic } from "@/lib/home-feed";
import type { VerifyChannel } from "@/lib/verify-channel";
import {
  LEAGUE_LABEL,
  LEAGUE_ORDER,
  foldTr,
  getTeam,
  type LeagueId,
  type Team,
} from "@/lib/teams";
import TeamColors from "@/components/TeamColors";
import { MilliTag } from "@/components/AyYildiz";
import { btnPrimary, btnSecondary, btnSm, chipClass, fieldClass } from "@/components/ui";
import { useLiveVotes } from "@/components/useLiveVotes";

// The map is ~300 KB of outlines with nothing for search engines to read, so it
// is drawn in the browser only; the server skips that work and the HTML stays
// small. The placeholder keeps its space so nothing jumps when it appears.
const TurkeyMap = dynamic(() => import("@/components/TurkeyMap"), {
  ssr: false,
  loading: () => (
    <div aria-hidden className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="w-full aspect-[1007/527] bg-sunken/60" />
      <div className="min-h-[200px]" />
    </div>
  ),
});

/** Rows shown before "Tümünü göster"; short lists and searches show everything. */
const COLLAPSED_ROWS = 10;
/** Lists up to this long are never collapsed: one more tap would cost more than it saves. */
const NO_COLLAPSE_UNDER = 13;

type TeamStat = Team & { votes: number };
type CityLeader = { teamId: string; votes: number; tied: boolean; coLeaderIds: string[] };
type CityStanding = { teamId: string; votes: number };

type Props = {
  initialTeams: TeamStat[];
  initialTotal: number;
  initialCities: Record<string, CityLeader>;
  initialStandings: Record<string, CityStanding[]>;
  /** Labelled starter votes included in the numbers above (0 when off). */
  initialOpening: number;
  leagues: { id: LeagueId; name: string; sortOrder: number }[];
  season: string | null;
  recentTopics: RecentTopic[];
  featuredTopics: RecentTopic[];
  /** Leagues an admin chose to show as filters on the home page. */
  homeLeagueIds: string[];
  generatedAt: string;
  /** How new members verify; the "how it works" copy follows it. */
  verifyChannel: VerifyChannel;
  /** Latest blog posts. */
  posts: { slug: string; title: string }[];
};

const n = (v: number) => v.toLocaleString("tr-TR");

const AS_OF_PARTS = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  // Same zone on the server (UTC) and in the browser.
  timeZone: "Europe/Istanbul",
});

/**
 * "23.10 10:37". Built from parts because Node and browsers join a
 * day-month-only date differently ("23/10" vs "23.10"), which breaks hydration.
 */
function formatAsOf(iso: string) {
  const p = Object.fromEntries(AS_OF_PARTS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

/** Section heading: one display size, one optional line of context under it. */
function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="font-anton text-[30px] md:text-[40px] leading-[1.05] tracking-tight uppercase">
        {title}
      </h2>
      {children && <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

export default function HomeClient({
  initialTeams,
  initialTotal,
  initialCities,
  initialStandings,
  initialOpening,
  leagues: initialLeagues,
  season: initialSeason,
  recentTopics,
  featuredTopics,
  homeLeagueIds,
  generatedAt,
  verifyChannel,
  posts,
}: Props) {
  const { user, loading } = useAuth();
  const [teams, setTeams] = useState(initialTeams);
  const [total, setTotal] = useState(initialTotal);
  const [cities, setCities] = useState(initialCities);
  const [standings, setStandings] = useState(initialStandings);
  const [opening, setOpening] = useState(initialOpening);
  const [asOf, setAsOf] = useState(generatedAt);
  const [leagues, setLeagues] = useState(initialLeagues);
  const [season, setSeason] = useState(initialSeason);
  const leagueOrder = useMemo(
    () => (leagues.length ? leagues.map((l) => l.id) : LEAGUE_ORDER),
    [leagues],
  );
  const leagueTabs = useMemo(
    () => leagueOrder.filter((id) => homeLeagueIds.includes(id)),
    [leagueOrder, homeLeagueIds],
  );
  const leagueLabel = useMemo(
    () => ({ ...LEAGUE_LABEL, ...Object.fromEntries(leagues.map((l) => [l.id, l.name])) }),
    [leagues],
  );
  const [league, setLeague] = useState<"all" | LeagueId>(() =>
    homeLeagueIds.includes("super") ? "super" : ((homeLeagueIds[0] as LeagueId | undefined) ?? "all"),
  );
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const myTeamId = user?.voteTeamId ?? null;
  const myTeam = myTeamId ? teams.find((t) => t.id === myTeamId) : undefined;
  const verified = total - opening;

  const ranked = useMemo(
    () =>
      [...teams].sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        const leagueDiff = leagueOrder.indexOf(a.league) - leagueOrder.indexOf(b.league);
        if (leagueDiff) return leagueDiff;
        return a.name.localeCompare(b.name, "tr");
      }),
    [teams, leagueOrder],
  );
  /** Overall rank, so a filtered list still says where a team stands in Türkiye. */
  const rankOf = useMemo(() => new Map(ranked.map((t, i) => [t.id, i + 1])), [ranked]);
  const topVotes = ranked[0]?.votes ?? 0;
  const podium = total > 0 ? ranked.slice(0, 3) : [];

  const filtered = useMemo(() => {
    const q = foldTr(query.trim());
    return ranked.filter((t) => {
      if (league !== "all" && t.league !== league) return false;
      if (!q) return true;
      return foldTr(t.name).includes(q) || foldTr(t.city).includes(q) || foldTr(t.short).includes(q);
    });
  }, [ranked, league, query]);
  const collapsible = !query.trim() && filtered.length >= NO_COLLAPSE_UNDER;
  const visible = collapsible && !showAll ? filtered.slice(0, COLLAPSED_ROWS) : filtered;

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setTeams(data.teams);
      setTotal(data.total);
      setCities(data.cities);
      setStandings(data.standings);
      setOpening(typeof data.opening === "number" ? data.opening : 0);
      if (data.generatedAt) setAsOf(data.generatedAt);
      if (Array.isArray(data.leagues)) setLeagues(data.leagues);
      if ("season" in data) setSeason(data.season ?? null);
    } catch {
      /* keep the last good numbers */
    } finally {
      setRefreshing(false);
    }
  }

  // Counts move on their own when someone votes.
  useLiveVotes(() => void refresh());

  function teamAction(teamId: string) {
    if (myTeamId) return null;
    if (!user) return `/uye-ol?takim=${encodeURIComponent(teamId)}`;
    return `/takim-sec?takim=${encodeURIComponent(teamId)}`;
  }

  function pickLeague(id: "all" | LeagueId) {
    setLeague(id);
    setShowAll(false);
  }

  const steps = [
    {
      t: "Üye ol",
      d:
        verifyChannel === "sms"
          ? "Cep telefonuna gelen kodla hesabını doğrula. Sahte hesaplar sayıma girmez."
          : "E-posta adresine gelen 6 haneli kodla hesabını doğrula. Sahte hesaplar sayıma girmez.",
    },
    {
      t: "Takımını bir kez seç",
      d: "Seçimin kalıcıdır, sonradan değişmez. Sayaçlar yalnızca bu seçimlerden hesaplanır.",
    },
    {
      t: "İlini boya, tribüne katıl",
      d: "Oyun ilinin rengini belirler. Takımının tribününde diğer taraftarlarla konuş.",
    },
  ];

  return (
    <div className="relative overflow-x-clip bg-paper text-ink">
      {/* ── Hero: what this is, the one action, and the live scoreboard ── */}
      <header className="border-b-[3px] border-line bg-surface">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-12">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              {season ? `${season} sezonu · ` : ""}81 il · {n(teams.length)} takım
            </p>
            <h1 className="mt-3 font-anton text-[44px] leading-[1.04] tracking-tight uppercase sm:text-[56px] md:text-[72px] md:leading-[1]">
              Türkiye&apos;nin{" "}
              <span className="bg-[linear-gradient(transparent_58%,var(--color-volt)_58%)] box-decoration-clone px-1">
                taraftar sayısı
              </span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed md:text-[19px]">
              Her doğrulanmış üye bir takıma bir kez, kalıcı olarak oy verir. 81 il bu oylarla
              takım renklerine boyanır.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {loading ? (
                <span className="min-h-11" aria-hidden />
              ) : myTeam ? (
                <>
                  <Link href={`/takim/${myTeam.id}/forum`} className={`${btnPrimary} px-6`}>
                    {myTeam.name} tribününe git →
                  </Link>
                  <Link href={`/takim/${myTeam.id}`} className={btnSecondary}>
                    Takımının sayısı
                  </Link>
                </>
              ) : (
                <>
                  <Link href={user ? "/takim-sec" : "/uye-ol"} className={`${btnPrimary} px-6`}>
                    Takımını seç →
                  </Link>
                  <a href="#harita" className={btnSecondary}>
                    Haritayı gör
                  </a>
                </>
              )}
            </div>
          </div>

          <Scoreboard
            total={total}
            verified={verified}
            opening={opening}
            podium={podium}
            asOf={asOf}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        </div>
      </header>

      {opening > 0 && (
        <div className="border-b-[3px] border-line bg-volt-soft">
          <p className="mx-auto max-w-[1240px] px-4 py-3 text-[14px] leading-snug md:px-8">
            <strong className="font-semibold">Açılış verisi:</strong> Harita ve sayaçlarda{" "}
            {n(opening)} başlangıç oyu var; site yeni açıldığı için boş görünmesin diye eklendi.
            Takım ve il sayfaları yalnızca doğrulanmış oyları gösterir.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-[1240px] px-4 md:px-8">
        {/* ── Map ── */}
        <section id="harita" aria-labelledby="harita-baslik" className="scroll-mt-4 py-10 md:py-14">
          <SectionHead id="harita-baslik" title="İl il taraftar haritası">
            Her il, orada en çok oy alan takımın renklerine boyanır. Bir ile dokun, özetini gör.
          </SectionHead>
          <TurkeyMap leaders={cities} standings={standings} />
        </section>

        {/* ── Standings + community ── */}
        <div className="grid gap-10 border-t-[3px] border-line py-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <section id="siralama" aria-labelledby="siralama-baslik" className="scroll-mt-4">
            <SectionHead id="siralama-baslik" title="Taraftar sayısı sıralaması">
              {opening > 0
                ? `${n(verified)} doğrulanmış taraftar + ${n(opening)} açılış verisi. Eşit oyda lig, sonra alfabe sırası.`
                : `${n(total)} doğrulanmış taraftar. Eşit oyda lig, sonra alfabe sırası.`}
            </SectionHead>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Lige göre süz">
              <button
                type="button"
                aria-pressed={league === "all"}
                onClick={() => pickLeague("all")}
                className={chipClass(league === "all")}
              >
                Tümü
              </button>
              {leagueTabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={league === id}
                  onClick={() => pickLeague(id)}
                  className={chipClass(league === id)}
                >
                  {leagueLabel[id]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Takım, il veya kısaltma ara"
                aria-label="Takım ara"
                className={`${fieldClass} sm:max-w-[360px]`}
              />
              <span className="font-mono text-[13px] text-muted sm:ml-auto" aria-live="polite">
                {n(filtered.length)} takım
              </span>
            </div>

            <ol className="mt-4 border-[3px] border-line bg-surface">
              {visible.map((team) => (
                <RankRow
                  key={team.id}
                  team={team}
                  rank={rankOf.get(team.id) ?? 0}
                  share={topVotes > 0 ? team.votes / topVotes : 0}
                  meta={`${leagueLabel[team.league]} · ${team.city}`}
                  mine={myTeamId === team.id}
                  action={teamAction(team.id)}
                />
              ))}
              {filtered.length === 0 && (
                <li className="p-5 text-[15px]">
                  <p className="font-semibold">Eşleşen takım yok.</p>
                  <p className="mt-1 text-muted">Aramayı kısalt ya da lig filtresini “Tümü” yap.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className={btnSm} onClick={() => setQuery("")}>
                      Aramayı temizle
                    </button>
                    <Link href="/takim-talep" className={btnSm}>
                      Takımım listede yok
                    </Link>
                  </div>
                </li>
              )}
            </ol>
            {collapsible && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className={`mt-3 w-full ${btnSecondary}`}
              >
                {showAll ? "Daha az göster" : `Tümünü göster (${n(filtered.length)})`}
              </button>
            )}
          </section>

          <aside className="space-y-10">
            <section aria-labelledby="nasil-baslik">
              <h2 id="nasil-baslik" className="font-anton text-[24px] uppercase leading-none">
                Nasıl çalışır?
              </h2>
              <ol className="mt-4 space-y-4">
                {steps.map((s, i) => (
                  <li key={s.t} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center border-[3px] border-line bg-volt font-anton text-[18px]"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{s.t}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="tribun-baslik">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="tribun-baslik" className="font-anton text-[24px] uppercase leading-none">
                  Tribünde
                </h2>
                <Link href="/forum" className="font-mono text-[13px] underline underline-offset-4 hover:bg-volt">
                  Tüm tribün →
                </Link>
              </div>
              {featuredTopics.length > 0 && (
                <TopicList label="Öne çıkanlar" topics={featuredTopics} teams={teams} highlight />
              )}
              {recentTopics.length > 0 ? (
                <TopicList
                  label={featuredTopics.length > 0 ? "Son konular" : undefined}
                  topics={recentTopics}
                  teams={teams}
                />
              ) : (
                <div className="mt-4 border-[3px] border-dashed border-line/40 p-4">
                  <p className="font-semibold">Tribün henüz sessiz.</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-muted">
                    Milli Takım Tribünü herkese açık. İlk konuyu sen aç, sohbeti sen başlat.
                  </p>
                  <Link href="/forum/milli-takim" className={`mt-3 ${btnSm}`}>
                    Milli Takım Tribünü
                  </Link>
                </div>
              )}
            </section>

            {posts.length > 0 && (
              <section aria-labelledby="notlar-baslik">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="notlar-baslik" className="font-anton text-[24px] uppercase leading-none">
                    Tribün Notları
                  </h2>
                  <Link href="/blog" className="font-mono text-[13px] underline underline-offset-4 hover:bg-volt">
                    Tüm yazılar →
                  </Link>
                </div>
                <ul className="mt-4 border-t-[2px] border-line">
                  {posts.map((p) => (
                    <li key={p.slug} className="border-b-[2px] border-hairline">
                      <Link
                        href={`/blog/${p.slug}`}
                        className="flex min-h-12 items-center py-2 text-[15px] font-semibold leading-snug hover:bg-volt/40"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

/**
 * The live total and the top three, styled as a stadium scoreboard: the one
 * place on the page where yellow sits on black.
 */
function Scoreboard({
  total,
  verified,
  opening,
  podium,
  asOf,
  refreshing,
  onRefresh,
}: {
  total: number;
  verified: number;
  opening: number;
  podium: TeamStat[];
  asOf: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section
      aria-label="Canlı sayım"
      className="border-[3px] border-line bg-ink text-surface shadow-[6px_6px_0_var(--color-volt)]"
    >
      <div className="flex items-center justify-between gap-3 border-b-[2px] border-white/15 px-5 py-3">
        <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/70">Canlı sayım</span>
        <span className="flex items-center gap-2 font-mono text-[12px] text-white/70">
          <span aria-hidden className="h-2 w-2 rounded-full bg-volt" />
          {formatAsOf(asOf)}
        </span>
      </div>
      <div className="px-5 pt-4 pb-5">
        <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/70">
          {opening > 0 ? "Sayaçtaki taraftar" : "Doğrulanmış taraftar"}
        </p>
        <p className="mt-1 font-anton text-[64px] leading-none tabular-nums text-volt md:text-[80px]">
          {n(total)}
        </p>
        {opening > 0 && (
          <p className="mt-2 font-mono text-[13px] text-white/80">
            {n(verified)} doğrulanmış + {n(opening)} açılış verisi
          </p>
        )}
      </div>
      <div className="border-t-[2px] border-white/15 px-5 py-4">
        <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-white/70">Zirve</p>
        {podium.length === 0 ? (
          <p className="mt-2 text-[15px] text-white/80">Henüz oy yok. İlk oyu sen ver.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {podium.map((t, i) => (
              <li key={t.id}>
                <Link
                  href={`/takim/${t.id}`}
                  className="flex min-h-10 items-center gap-3 hover:text-volt focus-visible:text-volt"
                >
                  <span className="w-5 font-anton text-[18px] text-white/60">{i + 1}</span>
                  <TeamColors team={t} size={11} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                  <span className="font-anton text-[20px] tabular-nums">{n(t.votes)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-busy={refreshing || undefined}
        className="flex min-h-11 w-full items-center justify-center gap-2 border-t-[2px] border-white/15 font-mono text-[13px] text-white/80 hover:bg-white/5 hover:text-volt disabled:opacity-60"
      >
        <span aria-hidden className={refreshing ? "inline-block animate-spin" : ""}>
          ↻
        </span>
        {refreshing ? "Yenileniyor…" : "Sayıları yenile"}
      </button>
    </section>
  );
}

function RankRow({
  team,
  rank,
  share,
  meta,
  mine,
  action,
}: {
  team: TeamStat;
  rank: number;
  share: number;
  meta: string;
  mine: boolean;
  action: string | null;
}) {
  return (
    <li
      className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b-[2px] border-hairline px-3 py-3 last:border-b-0 md:grid-cols-[2.75rem_minmax(0,1fr)_auto] md:gap-x-4 md:px-4 ${
        mine ? "bg-volt-soft" : ""
      }`}
    >
      <span className="font-anton text-[20px] tabular-nums text-muted md:text-[22px]">{rank}</span>
      <div className="min-w-0">
        <Link
          href={`/takim/${team.id}`}
          className="inline-flex max-w-full items-center gap-2 font-semibold leading-tight hover:underline underline-offset-4"
        >
          <span className="truncate">{team.name}</span>
          <TeamColors team={team} size={11} />
        </Link>
        <div className="mt-1 font-mono text-[12px] text-muted">{meta}</div>
        {/* Relative to the leader, so the gap between teams is visible at a glance. */}
        <div aria-hidden className="mt-2 h-1.5 bg-sunken">
          <div
            className="h-full bg-ink"
            style={{ width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 md:flex-row md:items-center md:gap-4">
        <span className="font-anton text-[22px] tabular-nums leading-none">
          {n(team.votes)}
          <span className="sr-only"> taraftar</span>
        </span>
        {mine ? (
          <span className="inline-flex min-h-10 items-center border-[2px] border-line bg-volt px-2.5 font-mono text-[12px] font-bold">
            Senin takımın
          </span>
        ) : action ? (
          <Link
            href={action}
            className="inline-flex min-h-10 items-center border-[2px] border-line px-2.5 font-mono text-[13px] hover:bg-ink hover:text-volt"
            aria-label={`${team.name} benim takımım`}
          >
            Takımım
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function TopicList({
  label,
  topics,
  teams,
  highlight = false,
}: {
  label?: string;
  topics: RecentTopic[];
  teams: TeamStat[];
  highlight?: boolean;
}) {
  return (
    <div className="mt-4">
      {label && <p className="mb-1 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">{label}</p>}
      <ul className={`border-t-[2px] border-line ${highlight ? "bg-volt-soft" : ""}`}>
        {topics.map((row) => {
          const team = row.teamId ? (teams.find((t) => t.id === row.teamId) ?? getTeam(row.teamId)) : undefined;
          return (
            <li key={row.id} className="border-b-[2px] border-hairline">
              <Link
                href={`/forum/konu/${row.id}`}
                className="flex min-h-12 items-center gap-3 px-1 py-2 hover:bg-volt/40"
              >
                {team ? <TeamColors team={team} size={10} /> : <MilliTag />}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{row.title}</span>
                  <span className="mt-0.5 block font-mono text-[12px] text-muted">@{row.authorUsername}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
