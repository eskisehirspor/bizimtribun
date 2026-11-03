import Link from "next/link";
import {
  cityBlurb,
  cityHeadline,
  cityLocative,
  type CityRecord,
} from "@/lib/cities";
import type { CityTeamRow } from "@/lib/city-rank";
import type { CityHistoryPoint } from "@/lib/city-stats";
import BackLink from "@/components/BackLink";
import CityShare from "@/components/CityShare";
import FanFacts from "@/components/FanFacts";
import { NATIONAL_CONTEXT, cityFacts } from "@/content/fan-facts";
import { btnPrimary, btnSecondary } from "@/components/ui";
import TeamColors from "@/components/TeamColors";
import { leagueLabels, listTeamCatalog } from "@/lib/team-catalog";

type Props = {
  city: CityRecord;
  total: number;
  rows: CityTeamRow[];
  history: CityHistoryPoint[];
  lastVoteAt: string | null;
  generatedAt: string;
  /** Team of the viewer's vote: only that team's tribune is open to them. */
  viewerTeamId?: string | null;
  /** Staff may read every team tribune. */
  viewerIsStaff?: boolean;
  /** "guest": not signed in, "novote": signed in without a vote, null: already voted. */
  voteCta?: "guest" | "novote" | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CityPageView({
  city,
  total,
  rows,
  history,
  lastVoteAt,
  generatedAt,
  viewerTeamId = null,
  viewerIsStaff = false,
  voteCta = null,
}: Props) {
  const catalog = new Map((await listTeamCatalog()).map((t) => [t.id, t]));
  const getTeam = (id: string) => catalog.get(id);
  const locative = cityLocative(city.name);
  const headline = `${locative} tribün dağılımı`;
  const topVotes = rows[0]?.votes ?? 0;
  const tiedTop = topVotes > 0 ? rows.filter((r) => r.votes === topVotes) : [];
  const isTie = tiedTop.length > 1;
  const summary =
    total === 0
      ? `${city.name} ilinde henüz doğrulanmış oy yok.`
      : isTie
        ? `Berabere: ${tiedTop.map((r) => r.name).join(" = ")} (%${tiedTop[0]!.percent})`
        : rows
            .slice(0, 3)
            .map((row, i) => `${i + 1}. ${row.name} %${row.percent}`)
            .join(" · ");
  const maxHistory = Math.max(1, ...history.map((h) => h.total));
  const forumRows = rows.filter((row) => row.forumHref);
  const leagues = await leagueLabels();
  // Catalog order: Süper Lig first, then down the leagues.
  const localTeams = [...catalog.values()].filter((t) => t.city === city.name && t.isActive);
  const sheet = cityFacts(city.name);

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[860px] mx-auto px-4 sm:px-5 py-6 md:py-8">
        <BackLink href="/">Türkiye haritası</BackLink>
        <p className="font-mono text-[11px] tracking-[0.2em] mt-2">
          BİZİM TRİBÜN • İL SAYIMI
        </p>
        <h1 className="font-anton text-[42px] md:text-[56px] leading-[1.05] mt-2">
          {city.name.toLocaleUpperCase("tr")}
        </h1>
        <p className="font-ultras text-[22px] md:text-[28px] leading-[1.2] mt-1.5 bg-[#FFEA00] inline-block px-2 py-[0.1em] border-[3px] border-black -rotate-1">
          {cityHeadline(city)}
        </p>
        <p className="font-mono text-[13px] mt-4 max-w-[52ch]">{cityBlurb(city)}</p>

        {voteCta && (
          <div className="mt-6 border-[4px] border-black bg-[#FFEA00] p-4 md:p-5 shadow-[8px_8px_0_black]">
            <p className="font-anton text-[26px] md:text-[32px] leading-[1.05]">
              {voteCta === "guest" ? "ÜYE OL, HEMEN OY KULLAN" : "HEMEN OY KULLAN"}
            </p>
            <p className="font-mono text-[13px] mt-2 max-w-[56ch]">
              Tuttuğun takımı seç, oyun {city.name} sayımına eklensin. Hesap başına bir kalıcı oy.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={voteCta === "guest" ? `/uye-ol?il=${city.slug}` : `/takim-sec?il=${city.slug}`}
                className={btnPrimary}
              >
                {voteCta === "guest" ? "ÜYE OL VE OY VER" : "TAKIMINI SEÇ, OY VER"}
              </Link>
              {voteCta === "guest" && (
                <Link
                  href={`/giris?next=${encodeURIComponent(`/takim-sec?il=${city.slug}`)}`}
                  className="font-mono text-[13px] underline underline-offset-4 decoration-2 min-h-10 inline-flex items-center"
                >
                  Zaten üye misin? Giriş yap
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[8px_8px_0_black]">
          <p className="font-mono text-[12px] opacity-70">DOĞRULANMIŞ OY</p>
          <p className="font-anton text-[48px] leading-none tabular-nums">
            {total.toLocaleString("tr-TR")}
          </p>
        </div>

        <section className="mt-6 border-[4px] border-black bg-white p-4 md:p-5 shadow-[8px_8px_0_black]">
          <h2 className="font-anton text-[26px] leading-[1.05]">{headline}</h2>
          <p className="font-mono text-[12px] mt-2">{summary}</p>
          {rows.length === 0 ? (
            <p className="font-mono text-[13px] mt-4">Bu ilde henüz oy yok.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {rows.map((row, i) => {
                const team = getTeam(row.teamId);
                return (
                  <li
                    key={row.teamId}
                    className={`flex items-center gap-2 border-[3px] border-black px-3 py-2 ${
                      row.votes === topVotes ? "bg-[#FFEA00]" : "bg-[#FFFEFA]"
                    }`}
                  >
                    <span className="font-anton text-[16px] w-7">
                      {row.votes === topVotes && isTie ? "=" : `${i + 1}.`}
                    </span>
                    {team ? <TeamColors team={team} size={12} /> : null}
                    <Link
                      href={`/takim/${row.teamId}`}
                      className="font-anton text-[16px] md:text-[18px] flex-1 leading-tight hover:underline inline-flex min-h-10 items-center"
                    >
                      {row.name}
                    </Link>
                    <span className="font-mono text-[12px] tabular-nums">
                      {row.votes.toLocaleString("tr-TR")} · %{row.percent}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {isTie && (
            <p className="font-mono text-[12px] mt-3 border-[2px] border-dashed border-black p-2">
              Bu ilde zirve berabere. Haritada çizgili gösterilir; hiçbir takım önde sayılmaz.
            </p>
          )}
          <p className="font-mono text-[12px] opacity-70 mt-3">
            Veri: {fmt(generatedAt)}
            {lastVoteAt ? ` • son oy ${fmt(lastVoteAt)}` : ""} • yalnızca doğrulanmış
            hesapların, hesap başına bir kalıcı oyu sayılır.
          </p>
          <div className="mt-4">
            <CityShare slug={city.slug} headline={headline} summary={summary} />
          </div>
        </section>

        <section aria-labelledby="il-takimlari" className="mt-6 border-[4px] border-black bg-[#FFFEFA] p-4 md:p-5 shadow-[6px_6px_0_black]">
          <h2 id="il-takimlari" className="font-anton text-[22px] leading-[1.05]">
            {`${city.name} takımları`.toLocaleUpperCase("tr")}
          </h2>
          {localTeams.length === 0 ? (
            <p className="font-mono text-[13px] mt-2 max-w-[60ch]">
              Sayımdaki ligler arasında (Süper Lig&apos;den Bölgesel Amatör Lig&apos;e) {city.name} ilinden bir takım yok.
              {" "}{city.name} taraftarları en çok hangi takımı tutuyor, yukarıdaki dağılım gösteriyor.
            </p>
          ) : (
            <>
              <p className="font-mono text-[13px] mt-2 max-w-[60ch]">
                {city.name} ilinden {localTeams.length} takım sayımda. Her birinin kaç taraftarı olduğu takım sayfasında.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {localTeams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/takim/${team.id}`}
                      className="flex min-h-11 items-center gap-2 border-[3px] border-black bg-white px-3 py-2 hover:bg-[#FFEA00]/40"
                    >
                      <TeamColors team={team} size={12} />
                      <span className="font-anton text-[16px] leading-tight flex-1">{team.name}</span>
                      <span className="font-mono text-[11px]">{leagues[team.league] ?? team.league}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <FanFacts
            id="il-anketleri"
            title={sheet.facts.length > 0 ? `${locative} anketler ne diyor?`.toLocaleUpperCase("tr") : "TÜRKİYE GENELİNDE ANKETLER"}
            intro={
              sheet.facts.length > 0
                ? `Bizim Tribün dışındaki il anketlerinden ${city.name} rakamları; her rakamın kaynağı yanında.`
                : `${city.name} için il bazında yayımlanmış bir anket sonucu bulamadık. Türkiye geneli için bilinen rakamlar:`
            }
            facts={sheet.facts.length > 0 ? sheet.facts : NATIONAL_CONTEXT}
            posts={sheet.posts}
          />
        </section>

        {history.some((h) => h.total > 0) && (
          <section className="mt-6 border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[6px_6px_0_black]">
            <h2 className="font-anton text-[22px] leading-[1.05]">SON 8 HAFTA</h2>
            <p className="font-mono text-[12px] mt-1 opacity-70">
              Her haftanın sonundaki doğrulanmış oy sayısı ve o haftanın lideri.
            </p>
            <ol className="mt-3 space-y-1">
              {history.map((h) => {
                const leaders = h.leaderIds.map((id) => getTeam(id)?.name ?? id);
                return (
                  <li key={h.weekEnding} className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="w-[82px] shrink-0 tabular-nums">
                      {new Date(h.weekEnding).toLocaleDateString("tr-TR")}
                    </span>
                    <span className="flex-1 h-[14px] border-[2px] border-black bg-white relative">
                      <span
                        className="absolute inset-y-0 left-0 bg-black"
                        style={{ width: `${(h.total / maxHistory) * 100}%` }}
                      />
                    </span>
                    <span className="w-[36px] text-right tabular-nums">{h.total}</span>
                    <span className="w-[42%] truncate">
                      {leaders.length === 0
                        ? "oy yok"
                        : leaders.length > 1
                          ? `berabere: ${leaders.join(" = ")}`
                          : leaders[0]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="mt-6">
          <h2 className="font-anton text-[22px]">TRİBÜNLER</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {forumRows
              .filter((row) => viewerIsStaff || row.teamId === viewerTeamId)
              .map((row) => (
                <Link key={row.teamId} href={row.forumHref!} className={btnSecondary}>
                  {`${row.name} Tribünü`.toLocaleUpperCase("tr")}
                </Link>
              ))}
          </div>
          <p className="font-mono text-[12px] mt-2 opacity-70">
            Takım tribünleri yalnızca o takımın taraftarlarına açık.{" "}
            <Link href="/takimlar" className="underline">
              Tüm takım tribünleri
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
