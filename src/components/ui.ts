/**
 * Shared control styles. Every tappable control is at least 40px tall
 * (44px for main actions), uses a visible yellow focus ring, and looks the
 * same across the site. Plain strings so server components can use them too.
 */

const focusRing =
  "focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFEA00]";

const disabled = "disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50";

const btnBase = `inline-flex items-center justify-center gap-2 text-center min-h-11 px-4 font-anton text-[15px] leading-tight border-[3px] border-black ${focusRing} ${disabled}`;

const btnSmBase = `inline-flex items-center justify-center gap-1.5 text-center min-h-10 px-3 font-anton text-[13px] leading-tight border-[3px] border-black ${focusRing} ${disabled}`;

/** Main action: black. */
export const btnPrimary = `${btnBase} bg-black text-white hover:bg-zinc-800`;
/** Secondary action: white. */
export const btnSecondary = `${btnBase} bg-white text-black hover:bg-[#FFEA00]/40`;
/** Attention action: yellow (sign in, verify…). */
export const btnAccent = `${btnBase} bg-[#FFEA00] text-black hover:bg-[#FFF35C]`;
/** Destructive action: red. */
export const btnDanger = `${btnBase} bg-[#C8102E] text-white hover:bg-[#A50D26]`;

/** Small buttons for row/secondary actions (40px tall). */
export const btnSm = `${btnSmBase} bg-white text-black hover:bg-[#FFEA00]/40`;
export const btnSmPrimary = `${btnSmBase} bg-black text-white hover:bg-zinc-800`;
export const btnSmAccent = `${btnSmBase} bg-[#FFEA00] text-black`;
export const btnSmDanger = `${btnSmBase} bg-[#C8102E] text-white hover:bg-[#A50D26]`;

/** Quiet text-like action that still has a 40px tap area (Bildir, Engelle…). */
export const btnGhost = `inline-flex items-center justify-center min-h-10 px-2 font-mono text-[13px] underline underline-offset-4 decoration-2 hover:bg-black/5 ${focusRing} ${disabled}`;

/** Filter / tab chip. Pair with aria-pressed. */
export const btnChip = btnSmBase;
export function chipClass(active: boolean) {
  return `${btnChip} ${active ? "bg-black text-[#FFEA00]" : "bg-white text-black hover:bg-[#FFEA00]/40"}`;
}

/** Text fields: 16px on phones so iOS does not zoom in. */
export const fieldClass = `w-full min-h-11 border-[3px] border-black px-3 py-2 font-mono text-base sm:text-[14px] bg-white text-black ${focusRing}`;
export const inputClass = `mt-1 ${fieldClass}`;

/** Field labels and small headings above controls. */
export const labelClass = "font-mono text-[12px] tracking-wide";
/** Help text under a field. */
export const hintClass = "font-mono text-[12px] opacity-70";

/** Checkbox / radio that is easy to hit. */
export const checkboxClass = "w-5 h-5 shrink-0 accent-black cursor-pointer";
export const checkLabelClass = "flex min-h-11 items-center gap-3 font-mono text-[13px] cursor-pointer";
