"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { citySlug } from "@/lib/cities";
import { compactCityPreview } from "@/lib/city-rank";
import { getTeam } from "@/lib/teams";
import mapData from "@/lib/turkey-paths.json";

type Standing = { teamId: string; votes: number };
type Leader = Standing & { tied?: boolean; coLeaderIds?: string[] };

type Props = {
  leaders: Record<string, Leader>;
  standings: Record<string, Standing[]>;
};

/** Provinces with no votes. Deliberately not a brand or team color. */
const NEUTRAL_FILL = "#E4E0D4";

type MapFile = {
  viewBox: string;
  provinces: { name: string; paths: string[] }[];
};

const data = mapData as MapFile;

export default function TurkeyMap({ leaders, standings }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const router = useRouter();
  const shown = hover ?? picked;
  const preview = shown ? compactCityPreview(standings[shown] ?? []) : null;

  function goCity(name: string) {
    setPicked(name);
    router.push(`/il/${citySlug(name)}`);
  }

  return (
    <div className="relative">
      <svg
        viewBox={data.viewBox}
        className="w-full h-auto turkey-map"
        role="img"
        aria-label="İllere ayrılmış Türkiye haritası"
      >
        <title>Türkiye illeri</title>
        <defs>
          <pattern
            id={`${uid}-tie`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="#FFFEFA" />
            <rect width="3" height="6" fill="#111" />
          </pattern>
          {data.provinces.map((il, idx) => {
            const lead = leaders[il.name];
            const t = lead && !lead.tied ? getTeam(lead.teamId) : undefined;
            if (!t) return null;
            return (
              <linearGradient
                key={il.name}
                id={`${uid}-il-${idx}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="50%" stopColor={t.bleed} />
                <stop offset="50%" stopColor={t.accent} />
              </linearGradient>
            );
          })}
        </defs>
        {data.provinces.map((il) => (
          <g key={`gap-${il.name}`} className="pointer-events-none">
            {il.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="#F2EFE6"
                stroke="#F2EFE6"
                strokeWidth={4.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>
        ))}
        {data.provinces.map((il, idx) => {
          const lead = leaders[il.name];
          const t = lead && !lead.tied ? getTeam(lead.teamId) : undefined;
          const fill = lead?.tied
            ? `url(#${uid}-tie)`
            : t
              ? `url(#${uid}-il-${idx})`
              : NEUTRAL_FILL;
          const active = shown === il.name;
          return (
            <g
              key={il.name}
              onMouseEnter={() => setHover(il.name)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(il.name)}
              onBlur={() => setHover(null)}
              onClick={() => goCity(il.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goCity(il.name);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`${il.name} il sayfası`}
              className="cursor-pointer outline-none"
            >
              {il.paths.map((d, i) => (
                <path
                  key={`halo-${i}`}
                  d={d}
                  fill="none"
                  stroke={active && t ? "#FFEA00" : "transparent"}
                  strokeWidth={3.4}
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
              ))}
              {il.paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fill}
                  stroke={active ? "#111" : "#1A1A1A"}
                  strokeWidth={active ? 2.15 : 1.5}
                  strokeLinejoin="round"
                  paintOrder="fill stroke"
                />
              ))}
            </g>
          );
        })}
      </svg>
      {shown && preview ? (
        <div className="mt-3 border-[3px] border-black bg-black text-[#FFEA00] p-3 font-mono text-[12px] shadow-[4px_4px_0_#FFEA00]">
          <p className="font-anton text-[18px] text-[#FFEA00]">{shown}</p>
          <p>Toplam geçerli oy: {preview.total.toLocaleString("tr-TR")}</p>
          {leaders[shown]?.tied ? <p>Liderlik eşit: ortak lider var</p> : null}
          {preview.first ? (
            <p>
              1. Takım: %{preview.first.percent} {preview.first.name}
            </p>
          ) : null}
          {preview.second ? (
            <p>
              2. Takım: %{preview.second.percent} {preview.second.name}
            </p>
          ) : (
            preview.total === 0 && <p>Henüz oy yok</p>
          )}
        </div>
      ) : (
        <div className="mt-3 min-h-[48px] font-ultras text-[22px] md:text-[26px] leading-tight tracking-wide border-[3px] border-black p-3 bg-[#FFEA00] -rotate-[0.4deg] shadow-[4px_4px_0_black]">
          İle tıkla, il sayfasına git. Üzerine gel ya da klavyeyle seç, özeti gör. Gri: henüz oy
          yok. Çizgili: liderlik eşit.
        </div>
      )}
    </div>
  );
}
