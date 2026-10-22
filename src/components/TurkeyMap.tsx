"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { citySlug } from "@/lib/cities";
import { compactCityPreview } from "@/lib/city-rank";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import mapData from "@/lib/turkey-paths.json";
import { btnAccent, fieldClass, labelClass } from "@/components/ui";

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
  const { getTeam } = useTeamCatalog();
  const shown = hover ?? picked;
  const preview = shown ? compactCityPreview(standings[shown] ?? [], getTeam) : null;
  /** How the last tap/click started: touch selects first, mouse opens straight away. */
  const pointerType = useRef<string>("mouse");
  const provinceNames = [...data.provinces.map((p) => p.name)].sort((a, b) => a.localeCompare(b, "tr"));

  function goCity(name: string) {
    setPicked(name);
    router.push(`/il/${citySlug(name)}`);
  }

  function tapCity(name: string) {
    if (pointerType.current === "mouse") {
      goCity(name);
      return;
    }
    // Touch: first tap shows the summary card; its button opens the province page.
    setPicked(name);
    setHover(null);
  }

  return (
    <div className="relative">
      <svg
        viewBox={data.viewBox}
        className="w-full h-auto turkey-map touch-manipulation"
        onPointerDown={(e) => {
          pointerType.current = e.pointerType || "mouse";
        }}
        role="img"
        aria-label="İllere ayrılmış Türkiye haritası"
      >
        <title>Türkiye illeri</title>
        <defs>
          {/* Each outline is drawn three times (gap, halo, fill); keeping one copy and
              reusing it cuts the home page HTML by roughly two thirds. */}
          {data.provinces.map((il, idx) =>
            il.paths.map((d, i) => <path key={`${idx}-${i}`} id={`${uid}-p-${idx}-${i}`} d={d} />),
          )}
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
        {data.provinces.map((il, idx) => (
          <g key={`gap-${il.name}`} className="pointer-events-none">
            {il.paths.map((_, i) => (
              <use
                key={i}
                href={`#${uid}-p-${idx}-${i}`}
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
          return (
            <g
              key={il.name}
              onMouseEnter={() => setHover(il.name)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(il.name)}
              onBlur={() => setHover(null)}
              onClick={() => tapCity(il.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goCity(il.name);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`${il.name} il sayfası`}
              className="cursor-pointer"
            >
              {il.paths.map((_, i) => (
                <use
                  key={i}
                  href={`#${uid}-p-${idx}-${i}`}
                  fill={fill}
                  stroke="#1A1A1A"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  paintOrder="fill stroke"
                />
              ))}
            </g>
          );
        })}
        {/* The hovered or picked province is drawn again on top, so its yellow
            outline is never hidden under the neighbours' borders. */}
        {data.provinces.map((il, idx) => {
          if (shown !== il.name) return null;
          const lead = leaders[il.name];
          const t = lead && !lead.tied ? getTeam(lead.teamId) : undefined;
          const fill = lead?.tied ? `url(#${uid}-tie)` : t ? `url(#${uid}-il-${idx})` : NEUTRAL_FILL;
          return (
            <g key={`active-${il.name}`} className="pointer-events-none">
              {il.paths.map((_, i) => (
                <use
                  key={`halo-${i}`}
                  href={`#${uid}-p-${idx}-${i}`}
                  fill="none"
                  stroke="#FFEA00"
                  strokeWidth={6}
                  strokeLinejoin="round"
                />
              ))}
              {il.paths.map((_, i) => (
                <use
                  key={i}
                  href={`#${uid}-p-${idx}-${i}`}
                  fill={fill}
                  stroke="#111"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
              ))}
            </g>
          );
        })}
      </svg>
      {shown && preview ? (
        <div
          className="mt-3 border-[3px] border-black bg-black text-[#FFEA00] p-3 font-mono text-[13px] shadow-[4px_4px_0_#FFEA00]"
          aria-live="polite"
        >
          <p className="font-anton text-[20px] text-[#FFEA00]">{shown}</p>
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
          {picked === shown && (
            <Link href={`/il/${citySlug(shown)}`} className={`mt-3 w-full sm:w-auto ${btnAccent}`}>
              {shown} sayımını aç →
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-3 min-h-[48px] font-ultras text-[20px] md:text-[24px] leading-tight tracking-wide border-[3px] border-black p-3 bg-[#FFEA00] -rotate-[0.4deg] shadow-[4px_4px_0_black]">
          Bir ile dokun ya da üzerine gel: özetini gör, sonra il sayfasına geç. Gri: henüz oy yok.
        </div>
      )}
      <label className="mt-4 block max-w-[420px]">
        <span className={labelClass}>İL SEÇ</span>
        <select
          className={`mt-1 ${fieldClass}`}
          value=""
          onChange={(e) => {
            if (e.target.value) goCity(e.target.value);
          }}
        >
          <option value="">Listeden bir il seç…</option>
          {provinceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
