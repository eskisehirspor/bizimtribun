import { formatPostDate } from "@/lib/blog";

/** Date, reading time and, for a post readers cannot see yet, a badge. */
export default function PostMeta({ date, minutes, badge }: { date: string; minutes: number; badge?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
      <time dateTime={date}>{formatPostDate(date)}</time>
      <span aria-hidden>·</span>
      <span>{minutes} dk okuma</span>
      {badge && <span className="border-[2px] border-flare px-1.5 text-flare">{badge}</span>}
    </p>
  );
}
