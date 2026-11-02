"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { citySlug } from "@/lib/cities";
import { compactCityPreview } from "@/lib/city-rank";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import mapData from "@/lib/turkey-paths.json";
import { btnPrimary, fieldClass, labelClass } from "@/components/ui";

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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
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
      {/* Side panel on wide screens, under the map on phones: the summary of
          the province in focus, the legend, and a list for keyboard and
          screen-reader users who would rather not walk 81 shapes. */}
      <div className="space-y-4 lg:sticky lg:top-4">
        <div className="border-[3px] border-line bg-surface p-4 lg:min-h-[188px]" aria-live="polite">
          {shown && preview ? (
            <>
              <p className="font-anton text-[28px] uppercase leading-none">{shown}</p>
              <p className="mt-2 font-mono text-[13px] text-muted">
                {preview.total.toLocaleString("tr-TR")} geçerli oy
              </p>
              {leaders[shown]?.tied ? (
                <p className="mt-2 text-[14px] font-semibold">Liderlik eşit: ortak lider var.</p>
              ) : null}
              {preview.total === 0 ? (
                <p className="mt-3 text-[15px]">Bu ilde henüz oy yok.</p>
              ) : (
                <dl className="mt-3 space-y-1.5 text-[15px]">
                  {[preview.first, preview.second].map((row, i) =>
                    row ? (
                      <div key={i} className="flex items-baseline justify-between gap-3">
                        <dt className="min-w-0 truncate font-semibold">
                          {i + 1}. {row.name}
                        </dt>
                        <dd className="font-anton text-[20px] tabular-nums">%{row.percent}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              )}
              {picked === shown && (
                <Link href={`/il/${citySlug(shown)}`} className={`mt-4 w-full ${btnPrimary}`}>
                  {shown} sayımını aç →
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">Bir ile dokun ya da üzerine gel.</p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">
                İlin özetini burada gör, sonra il sayfasına geç.
              </p>
            </>
          )}
        </div>
        <ul className="space-y-1.5 font-mono text-[12px] text-muted" aria-label="Harita açıklaması">
          <li className="flex items-center gap-2">
            <span aria-hidden className="inline-flex h-3 w-6 border-[2px] border-line">
              <span className="w-1/2 bg-flare" />
              <span className="w-1/2 bg-volt" />
            </span>
            Lider takımın renkleri
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-3 w-6 border-[2px] border-line bg-[repeating-linear-gradient(45deg,#111_0_2px,#fffefa_2px_4px)]"
            />
            Eşitlik
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-6 border-[2px] border-line" style={{ background: NEUTRAL_FILL }} />
            Henüz oy yok
          </li>
        </ul>
        <label className="block">
          <span className={labelClass}>Listeden il seç</span>
          <select
            className={`mt-1 ${fieldClass}`}
            value=""
            onChange={(e) => {
              if (e.target.value) goCity(e.target.value);
            }}
          >
            <option value="">81 il…</option>
            {provinceNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
