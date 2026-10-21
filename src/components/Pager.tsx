"use client";

const pagerBtn =
  "inline-flex min-h-11 min-w-11 items-center justify-center border-[3px] border-black bg-white font-anton text-[18px] hover:bg-[#FFEA00]/40 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFEA00]";

/** Previous / next pagination used by boards, topics and admin tables. */
export default function Pager({
  page,
  pages,
  onPage,
  summary,
  className = "",
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** Extra text before the page number, e.g. "120 kayıt". */
  summary?: string;
  className?: string;
}) {
  if (pages <= 1 && !summary) return null;
  return (
    <nav
      aria-label="Sayfalar"
      className={`mt-4 flex flex-wrap items-center justify-center gap-3 ${className}`}
    >
      {summary && <span className="font-mono text-[13px] mr-auto">{summary}</span>}
      {pages > 1 && (
        <>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Önceki sayfa"
            className={pagerBtn}
          >
            ←
          </button>
          <span className="font-mono text-[13px] tabular-nums" aria-live="polite">
            Sayfa {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            aria-label="Sonraki sayfa"
            className={pagerBtn}
          >
            →
          </button>
        </>
      )}
    </nav>
  );
}
