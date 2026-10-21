"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import BackLink from "@/components/BackLink";
import Pager from "@/components/Pager";
import { btnAccent, btnPrimary, btnSecondary, btnSm, chipClass } from "@/components/ui";
import { isStaffRole } from "@/lib/permissions";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_META,
  isForumCategory,
  type ForumCategory,
  type TopicSort,
} from "@/lib/forum-category";
import { formatForumDate } from "@/lib/forum-ui";
import ForumAuthorName from "@/components/ForumAuthorName";
import TeamBoardGate, { isTeamBoardCode } from "@/components/forum/TeamBoardGate";

type TopicRow = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  category: ForumCategory;
  isPinned: boolean;
  postCount: number;
  likeCount?: number;
  author: { id: number; username: string; isFanOfWeek?: boolean };
};

type Props = {
  /** API path that lists and creates topics, e.g. /api/forum/genel/topics. */
  apiPath: string;
  /** Page that opens the new-topic form for this board. */
  newTopicPath: string;
  backHref: string;
  backLabel: string;
  /** Board heading (team mark, title, leaders, …). Receives the topic count. */
  header: (total: number) => React.ReactNode;
  /** False while the board is unknown or closed. */
  active: boolean;
  closedTitle?: string;
  closedBody?: string;
  /**
   * Set on team tribunes. Visitors who are not that team's fans see the lock
   * screen straight away instead of a request the server would refuse.
   */
  teamId?: string;
  /** Title for the lock screen, e.g. "Eskişehirspor Tribünü". */
  gateTitle?: string;
};

const SORTS = [
  ["activity", "Son aktivite"],
  ["newest", "En yeni"],
] as const;

/** Topic list shared by team tribunes, Genel Tribün and province tribunes. */
export default function ForumBoardView({
  apiPath,
  newTopicPath,
  backHref,
  backLabel,
  header,
  active,
  closedTitle = "TRİBÜN YOK",
  closedBody = "Bu tribün henüz açılmadı.",
  teamId,
  gateTitle,
}: Props) {
  const { user, banned, message, loading } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TopicSort>("activity");
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [total, setTotal] = useState(0);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gated, setGated] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const limit = 20;

  // Restore category / sort / page from the address so Back returns to the same view.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const rawCategory = q.get("category");
    const rawPage = Number(q.get("page"));
    const rawSort = q.get("sort");
    void Promise.resolve().then(() => {
      if (isForumCategory(rawCategory)) setCategory(rawCategory);
      if (rawSort === "newest") setSort("newest");
      if (Number.isInteger(rawPage) && rawPage > 1) setPage(rawPage);
      setUrlReady(true);
    });
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const q = new URLSearchParams(window.location.search);
    if (category) q.set("category", category);
    else q.delete("category");
    if (sort !== "activity") q.set("sort", sort);
    else q.delete("sort");
    if (page > 1) q.set("page", String(page));
    else q.delete("page");
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [urlReady, category, sort, page]);

  // Team tribunes: only that team's fans read them (staff may read to moderate).
  const viewerTeam = user?.voteTeamId ?? null;
  const lockedOut = Boolean(
    teamId && !loading && (!user || (!isStaffRole(user.role) && viewerTeam !== teamId)),
  );
  const waitForViewer = Boolean(teamId && loading);

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
      if (category) params.set("category", category);
      const res = await fetch(`${apiPath}?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (isTeamBoardCode(data.code)) setGated(data.board?.name ?? "Takım tribünü");
        setLoadError(data.error || "Tribün yüklenemedi.");
        setTopics([]);
        return;
      }
      setGated(null);
      setTotal(data.total ?? 0);
      setTopics(data.topics ?? []);
    } catch {
      setLoadError("Bağlantı kopuk. İnternetini kontrol edip tekrar dene.");
    } finally {
      setBusy(false);
    }
  }, [apiPath, page, category, sort]);

  const viewerId = user?.id;
  useEffect(() => {
    if (active && urlReady && !lockedOut && !waitForViewer) void Promise.resolve().then(load);
    // Signing in or out changes what a team tribune shows.
  }, [active, urlReady, lockedOut, waitForViewer, load, viewerId]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const meta = category ? FORUM_CATEGORY_META[category] : null;
  const newHref = category ? `${newTopicPath}?category=${category}` : newTopicPath;
  const boardPath = newTopicPath.replace(/\/yeni$/, "");

  if (active && (gated || lockedOut)) {
    return <TeamBoardGate title={gated ?? gateTitle ?? "Takım tribünü"} next={boardPath} />;
  }

  if (!active) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[36px]">{closedTitle}</h1>
        <p className="font-mono text-[14px] mt-2">{closedBody}</p>
        <Link href={backHref} className={`mt-4 ${btnSecondary}`}>
          ← {backLabel.toLocaleUpperCase("tr")}
        </Link>
      </ForumShell>
    );
  }

  const pick = (next: ForumCategory | null) => {
    setCategory(next);
    setPage(1);
  };

  return (
    <ForumShell>
      <BackLink href={backHref}>{backLabel}</BackLink>
      {header(total)}

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Kategori">
        <button type="button" aria-pressed={category === null} onClick={() => pick(null)} className={chipClass(category === null)}>
          TÜMÜ
        </button>
        {FORUM_CATEGORIES.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => pick(key)}
            className={chipClass(category === key)}
          >
            {FORUM_CATEGORY_META[key].tab}
          </button>
        ))}
      </div>
      <p className="font-mono text-[12px] mt-2 opacity-70">
        {meta ? meta.blurb : "Bütün kategorilerdeki konular. Daraltmak için bir kategori seç."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {banned ? (
          <p className="font-mono text-[13px] border-[2px] border-black p-2 bg-[#C8102E]/10">
            {message || "Hesabın askıda. Yazı yazamazsın."}
          </p>
        ) : user && !user.phoneVerified ? (
          <Link href="/takim-sec" className={btnAccent}>
            YAZMAK İÇİN TELEFONUNU DOĞRULA
          </Link>
        ) : user ? (
          <Link href={newHref} className={btnPrimary}>
            + YENİ KONU
          </Link>
        ) : (
          <Link
            href={loading ? "#" : `/giris?next=${encodeURIComponent(newHref)}`}
            className={btnAccent}
          >
            KONU AÇMAK İÇİN GİRİŞ YAP
          </Link>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2" role="group" aria-label="Sırala">
          <span className="font-mono text-[12px]" aria-hidden="true">
            Sırala:
          </span>
          {SORTS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => {
                setSort(key);
                setPage(1);
              }}
              className={chipClass(sort === key)}
            >
              {label.toLocaleUpperCase("tr")}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-[4px] border-black bg-[#FFFEFA] shadow-[6px_6px_0_black]" aria-busy={busy}>
        {busy ? (
          <p className="p-6 font-mono text-[14px]">Konular yükleniyor…</p>
        ) : loadError ? (
          <div className="p-6">
            <p className="font-mono text-[14px]">{loadError}</p>
            <button type="button" onClick={() => void load()} className={`mt-3 ${btnSm}`}>
              TEKRAR DENE
            </button>
          </div>
        ) : topics.length === 0 ? (
          <div className="p-8 text-center">
            {meta ? (
              <>
                <p className="font-anton text-[26px] leading-none">BU KATEGORİDE KONU YOK</p>
                <p className="font-mono text-[14px] mt-2">
                  {meta.label} kategorisinde henüz konu açılmadı.
                </p>
                <button type="button" onClick={() => pick(null)} className={`mt-4 ${btnSecondary}`}>
                  TÜM KONULARI GÖSTER
                </button>
              </>
            ) : (
              <>
                <p className="font-anton text-[28px] leading-none">TRİBÜN BOŞ</p>
                <p className="font-mono text-[14px] mt-2">İlk konuyu sen aç. Sesini duyur.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y-[2px] divide-black">
            {topics.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/forum/konu/${t.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-3 min-h-14 hover:bg-[#FFEA00]/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-anton text-[18px] leading-tight">
                      {t.isPinned ? (
                        <span className="mr-2 font-mono text-[11px] bg-[#FFEA00] border-[2px] border-black px-1 align-middle">
                          SABİT
                        </span>
                      ) : null}{" "}
                      {t.title}
                      {t.lockedAt ? (
                        <span className="ml-2 font-mono text-[11px] bg-black text-white px-1 align-middle">KİLİTLİ</span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[12px] opacity-70 mt-1">
                      {!category && FORUM_CATEGORY_META[t.category] ? `${FORUM_CATEGORY_META[t.category].label} • ` : ""}
                      <ForumAuthorName
                        username={t.author.username}
                        isFanOfWeek={t.author.isFanOfWeek}
                      />{" "}
                      • {formatForumDate(t.createdAt)}
                    </div>
                  </div>
                  <div className="font-mono text-[12px] sm:text-right shrink-0">
                    <div>
                      {t.postCount} yorum{t.likeCount ? ` • 👏 ${t.likeCount}` : ""}
                    </div>
                    <div className="opacity-60">son: {formatForumDate(t.updatedAt)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Pager page={page} pages={pages} onPage={setPage} />
    </ForumShell>
  );
}
