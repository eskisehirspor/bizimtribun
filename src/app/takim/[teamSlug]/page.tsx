import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import { citySlug } from "@/lib/cities";
import { teamSummary } from "@/lib/stats";
import { getCatalogTeam, leagueLabels } from "@/lib/team-catalog";
import { teamPageMetadata } from "@/lib/team-seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ teamSlug: string }> }): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = getCatalogTeam(teamSlug);
  if (!team) return { robots: { index: false, follow: false } };
  return teamPageMetadata(team, leagueLabels()[team.league] ?? team.league);
}

const n = (v: number) => v.toLocaleString("tr-TR");

export default async function TeamPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const team = getCatalogTeam(teamSlug);
  if (!team) notFound();
  if (team.id !== teamSlug) permanentRedirect(`/takim/${team.id}`);
  const summary = teamSummary(team.id);
  const league = leagueLabels()[team.league] ?? team.league;
  const generatedAt = new Date();
  const share = summary && summary.total > 0 ? Math.round((summary.votes / summary.total) * 1000) / 10 : 0;

  return (
    <ForumShell>
      <Link href="/takimlar" className="font-mono text-[11px] underline">
        ← Tüm takımlar
      </Link>
      <section className="mt-3 border-[4px] border-black shadow-[8px_8px_0_black]" style={{ background: team.paper }}>
        <div className="flex flex-wrap items-center gap-4 p-5 border-b-[4px] border-black">
          <TeamMark team={team} size={72} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em]">
              {league.toLocaleUpperCase("tr")} • {team.city.toLocaleUpperCase("tr")}
            </p>
            <h1 className="font-anton text-[38px] sm:text-[52px] leading-[0.9]">{team.name.toLocaleUpperCase("tr")}</h1>
            {!team.isActive && (
              <p className="font-mono text-[11px] mt-1 bg-black text-white inline-block px-1">
                Bu takım şu an listede pasif; geçmiş oyları sayımda kalır.
              </p>
            )}
          </div>
        </div>
        <div className="bg-[#FFFEFA] p-5">
          {!summary || summary.votes === 0 ? (
            <p className="font-mono text-[13px]">
              Henüz doğrulanmış taraftar yok. İlk taraftar sen olabilirsin.
            </p>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-4 border-[3px] border-black">
              {[
                ["DOĞRULANMIŞ TARAFTAR", n(summary.votes)],
                ["TÜRKİYE SIRASI", summary.rank ? `${summary.rank}.${summary.tiedWith ? " (eşit)" : ""}` : "—"],
                [`${league.toLocaleUpperCase("tr")} SIRASI`, summary.leagueRank ? `${summary.leagueRank}.` : "—"],
                ["TOPLAMDAKİ PAY", `%${share.toLocaleString("tr-TR")}`],
              ].map(([label, value]) => (
                <div key={label} className="p-3 border-[1.5px] border-black bg-white">
                  <dt className="font-mono text-[10px]">{label}</dt>
                  <dd className="font-anton text-[30px] leading-none mt-1">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {summary && summary.votes > 0 && (
            <>
              <p className="font-mono text-[12px] mt-3">
                {summary.provincesLed} ilde tek başına lider
                {summary.provincesCoLed ? `, ${summary.provincesCoLed} ilde liderliği paylaşıyor` : ""}.
              </p>
              <h2 className="font-anton text-[22px] mt-5">EN ÇOK TARAFTARI OLAN İLLER</h2>
              {summary.topProvinces.length === 0 ? (
                <p className="font-mono text-[12px] opacity-70">İl bilgisi veren taraftar yok.</p>
              ) : (
                <ol className="mt-2 border-[3px] border-black bg-white divide-y-[2px] divide-black">
                  {summary.topProvinces.map((p, i) => (
                    <li key={p.province}>
                      <Link href={`/il/${citySlug(p.province)}`} className="flex justify-between p-2 font-mono text-[13px] hover:bg-[#FFEA00]/40">
                        <span>
                          {i + 1}. {p.province}
                        </span>
                        <span className="tabular-nums">{n(p.votes)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <p className="font-mono text-[10px] opacity-60 mt-4">
            Veri zamanı:{" "}
            {generatedAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" })}.
            Yalnızca SMS ile doğrulanmış hesapların tek ve kalıcı oyları sayılır.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {team.isForumActive && (
              <Link href={`/takim/${team.id}/forum`} className="font-anton text-[15px] bg-black text-white border-[3px] border-black px-4 py-2">
                {team.name.toLocaleUpperCase("tr")} TRİBÜNÜ
              </Link>
            )}
            <Link href={`/il/${citySlug(team.city)}`} className="font-anton text-[15px] bg-white border-[3px] border-black px-4 py-2">
              {team.city.toLocaleUpperCase("tr")} SAYIMI
            </Link>
          </div>
        </div>
      </section>
    </ForumShell>
  );
}
