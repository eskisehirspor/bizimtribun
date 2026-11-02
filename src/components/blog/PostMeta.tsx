import { formatPostDate } from "@/lib/blog";

/** Date, reading time and a draft badge, above a post title. */
export default function PostMeta({ date, minutes, draft }: { date: string; minutes: number; draft?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.08em] text-muted">
      <time dateTime={date}>{formatPostDate(date)}</time>
      <span aria-hidden>·</span>
      <span>{minutes} dk okuma</span>
      {draft && <span className="border-[2px] border-flare px-1.5 text-flare">Taslak</span>}
    </p>
  );
}
