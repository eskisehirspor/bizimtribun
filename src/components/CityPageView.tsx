import Link from "next/link";
import {
  cityBlurb,
  cityHeadline,
  cityLocative,
  type CityRecord,
} from "@/lib/cities";
import type { CityTeamRow } from "@/lib/city-rank";
import CityShare from "@/components/CityShare";
import TeamColors from "@/components/TeamColors";
import { getTeam } from "@/lib/teams";

type Props = {
  city: CityRecord;
  total: number;
  rows: CityTeamRow[];
};

export default function CityPageView({ city, total, rows }: Props) {
  const locative = cityLocative(city.name);
  const headline = `${locative} bu haftanın tribün dağılımı`;
  const summary =
    total === 0
      ? `${city.name} ilinde henüz doğrulanmış oy yok.`
      : rows
          .slice(0, 3)
          .map((row, i) => `${i + 1}. ${row.name} %${row.percent}`)
          .join(" · ");

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[860px] mx-auto px-4 sm:px-5 py-6 md:py-8">
        <p className="font-mono text-[10px] tracking-[0.2em]">
          BİZİM TRİBÜN • İL SAYIMI
        </p>
        <h1 className="font-anton text-[42px] md:text-[56px] leading-[0.85] mt-2">
          {city.name.toLocaleUpperCase("tr")}
        </h1>
        <p className="font-ultras text-[22px] md:text-[28px] mt-3 bg-[#FFEA00] inline-block px-2 border-[3px] border-black -rotate-1">
          {cityHeadline(city)}
        </p>
        <p className="font-mono text-[13px] mt-4 max-w-[52ch]">{cityBlurb(city)}</p>

        <div className="mt-6 border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[8px_8px_0_black]">
          <p className="font-mono text-[10px] opacity-60">DOĞRULANMIŞ OY</p>
          <p className="font-anton text-[48px] leading-none tabular-nums">
            {total.toLocaleString("tr-TR")}
          </p>
        </div>

        <section className="mt-6 border-[4px] border-black bg-white p-4 md:p-5 shadow-[8px_8px_0_black]">
          <h2 className="font-anton text-[26px] leading-none">{headline}</h2>
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
                      i === 0 ? "bg-[#FFEA00]" : "bg-[#FFFEFA]"
                    }`}
                  >
                    <span className="font-anton text-[16px] w-7">{i + 1}.</span>
                    {team ? <TeamColors team={team} size={12} /> : null}
                    <span className="font-anton text-[16px] md:text-[18px] flex-1 leading-tight">
                      {row.name}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums">
                      {row.votes.toLocaleString("tr-TR")} · %{row.percent}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-4">
            <CityShare slug={city.slug} headline={headline} summary={summary} />
          </div>
        </section>

        {rows.some((row) => row.forumHref) ? (
          <section className="mt-6">
            <h2 className="font-anton text-[22px]">AKTİF FORUMLAR</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {rows
                .filter((row) => row.forumHref)
                .map((row) => (
                  <Link
                    key={row.teamId}
                    href={row.forumHref!}
                    className="font-anton text-[14px] border-[3px] border-black bg-[#FFFEFA] px-3 py-2"
                  >
                    {row.name} FORUM
                  </Link>
                ))}
            </div>
          </section>
        ) : null}

        <p className="mt-8 font-mono text-[12px]">
          <Link href="/" className="underline">
            ← Türkiye haritası
          </Link>
        </p>
      </div>
    </div>
  );
}
