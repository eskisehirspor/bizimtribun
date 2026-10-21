import type { ReactNode } from "react";
import { NATIONAL_RED } from "@/lib/national-board";

// Crescent and star with the flag's proportions (flag height 20): outer circle r 5 at
// (10, 10), inner circle r 4 at (11.25, 10), star r 2.5 at (16.67, 10) with a point to the left.
const CRESCENT = "M14.225 7.326A5 5 0 1 0 14.225 12.674A4 4 0 1 1 14.225 7.326Z";
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 2.5 : 2.5 * 0.382;
  const a = Math.PI + (i * Math.PI) / 5;
  return `${(16.667 + r * Math.cos(a)).toFixed(3)} ${(10 + r * Math.sin(a)).toFixed(3)}`;
}).join(" L");
const STAR_PATH = `M${STAR}Z`;

/** Crescent and star only, in `color` (white by default). Box is 5 to 19.2 wide, 5 to 15 high. */
export function AyYildiz({
  size = 16,
  color = "#FFFFFF",
  className,
  title,
}: {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="4.6 4.6 15 10.8"
      width={(size * 15) / 10.8}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d={CRESCENT} fill={color} />
      <path d={STAR_PATH} fill={color} />
    </svg>
  );
}

/** Small red tag with a white crescent and star, used where a team colour would go. */
export function MilliTag({ label = "MİLLİ" }: { label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 border border-black px-1 text-[11px] text-white"
      style={{ backgroundColor: NATIONAL_RED }}
    >
      <AyYildiz size={9} />
      {label}
    </span>
  );
}

/**
 * Red panel with a big crescent and star leaning out of the right edge behind the content,
 * and a white band along the bottom.
 */
export function MilliPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border-[4px] border-black text-white shadow-[6px_6px_0_black] ${className}`}
      style={{ backgroundColor: NATIONAL_RED }}
    >
      <AyYildiz
        size={170}
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 -rotate-[14deg] opacity-25 drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]"
      />
      <div className="absolute inset-x-0 bottom-0 h-[6px] bg-white" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}
