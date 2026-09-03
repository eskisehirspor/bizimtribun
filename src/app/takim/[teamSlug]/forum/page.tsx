"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_DEFAULT,
  FORUM_CATEGORY_META,
  tribunTitle,
  type ForumCategory,
  type TopicSort,
} from "@/lib/forum-category";
import { FORUM_ACTIVE_TEAM_IDS, LEAGUE_LABEL, getTeam } from "@/lib/teams";
import { formatForumDate } from "@/lib/forum-ui";
import ForumAuthorName from "@/components/ForumAuthorName";

type TopicRow = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  category: ForumCategory;
  isPinned: boolean;
  postCount: number;
  author: { id: number; username: string; isTribunLeader?: boolean };
};

type LeaderRow = {
  period: string;
  username: string;
  postCount: number;
};

export default function TeamForumPage() {
  const rawSlug = useParams<{ teamSlug: string }>().teamSlug;
  const teamSlug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || "";
  const { user, banned, message, loading } = useAuth();
  const team = getTeam(teamSlug);
  const active = FORUM_ACTIVE_TEAM_IDS.includes(teamSlug);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TopicSort>("activity");
  const [category, setCategory] = useState<ForumCategory>(FORUM_CATEGORY_DEFAULT);
  const [total, setTotal] = useState(0);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/forum/teams/${teamSlug}/topics?page=${page}&limit=${limit}&category=${category}&sort=${sort}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Tribün yüklenemedi.");
        setTopics([]);
        return;
      }
      setTotal(data.total ?? 0);
      setTopics(data.topics ?? []);
    } catch {
      setLoadError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }, [teamSlug, page, category, sort]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetch(`/api/forum/teams/${teamSlug}/leaders?limit=6`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        setLeaders(data.leaders ?? []);
      })
      .catch(() => {
        if (!cancelled) setLeaders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, teamSlug]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const meta = FORUM_CATEGORY_META[category];
  const newHref = `/takim/${teamSlug}/forum/yeni?category=${category}`;

  if (!team || !active) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[36px]">TRİBÜN YOK</h1>
        <p className="font-mono text-[13px] mt-2">Bu takımda henüz tribün açılmadı.</p>
        <Link href="/takimlar" className="mt-4 inline-block font-anton border-[3px] border-black px-3 py-2 bg-white">
          TAKIMLARA DÖN
        </Link>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <Link href="/takimlar" className="font-mono text-[11px] underline">
        ← Tüm tribünler
      </Link>
      <div className="mt-3 flex items-start gap-3">
        <TeamMark team={team} size={56} />
        <div className="min-w-0">
          <h1 className="font-anton text-[32px] sm:text-[42px] leading-[0.85]">
            {tribunTitle(team.name)}
          </h1>
          <p className="font-mono text-[11px] opacity-60 mt-1">
            {LEAGUE_LABEL[team.league]} • {total} konu
          </p>
        </div>
      </div>
      {leaders.length > 0 ? (
        <div className="mt-4 border-[3px] border-black bg-white p-3">
          <p className="font-anton text-[13px]">TRİBÜN LİDERLERİ</p>
          <ul className="mt-1 font-mono text-[11px] space-y-0.5">
            {leaders.map((row) => (
              <li key={`${row.period}-${row.username}`}>
                {row.period} — {row.username} ({row.postCount} yazı)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {FORUM_CATEGORIES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setCategory(key);
              setPage(1);
            }}
            className={`font-anton text-[12px] sm:text-[13px] px-3 py-2 border-[3px] border-black ${
              category === key ? "bg-black text-[#FFEA00]" : "bg-white"
            }`}
          >
            {FORUM_CATEGORY_META[key].tab}
          </button>
        ))}
      </div>
      <p className="font-mono text-[11px] mt-2 opacity-70">{meta.blurb}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {banned ? (
          <p className="font-mono text-[12px] border-[2px] border-black p-2 bg-[#C8102E]/10">
            {message || "Hesabın askıda. Yazı yazamazsın."}
          </p>
        ) : user && !user.emailVerified ? (
          <Link
            href="/uye-dogrula"
            className="font-anton text-[15px] bg-[#FFEA00] border-[3px] border-black px-4 py-2"
          >
            YAZMAK İÇİN E-POSTA DOĞRULA
          </Link>
        ) : user ? (
          <Link
            href={newHref}
            className="font-anton text-[15px] bg-black text-white border-[3px] border-black px-4 py-2"
          >
            YENİ KONU
          </Link>
        ) : (
          <Link
            href={loading ? "#" : `/giris?next=${encodeURIComponent(newHref)}`}
            className="font-anton text-[15px] bg-[#FFEA00] border-[3px] border-black px-4 py-2"
          >
            KONU AÇMAK İÇİN GİRİŞ YAP
          </Link>
        )}
        <div className="ml-auto flex gap-1">
          {(
            [
              ["activity", "Son Aktivite"],
              ["newest", "En Yeni"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSort(key);
                setPage(1);
              }}
              className={`font-anton text-[12px] px-3 py-1 border-[3px] border-black ${
                sort === key ? "bg-black text-[#FFEA00]" : "bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-[4px] border-black bg-[#FFFEFA] shadow-[6px_6px_0_black]">
        {busy ? (
          <p className="p-6 font-mono text-[13px]">Yükleniyor…</p>
        ) : loadError ? (
          <p className="p-6 font-mono text-[13px]">{loadError}</p>
        ) : topics.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-anton text-[28px] leading-none">TRİBÜN BOŞ</p>
            <p className="font-mono text-[13px] mt-2">İlk konuyu sen aç. Sesini duyur.</p>
          </div>
        ) : (
          <ul className="divide-y-[2px] divide-black">
            {topics.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/forum/konu/${t.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-3 hover:bg-[#FFEA00]/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-anton text-[18px] leading-tight">
                      {t.isPinned ? (
                        <span className="mr-2 font-mono text-[10px] bg-[#FFEA00] border-[2px] border-black px-1 align-middle">
                          SABİT
                        </span>
                      ) : null}{" "}
                      {t.title}
                      {t.lockedAt ? (
                        <span className="ml-2 font-mono text-[10px] bg-black text-white px-1">KİLİT</span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[11px] opacity-70 mt-1">
                      <ForumAuthorName
                        username={t.author.username}
                        isTribunLeader={t.author.isTribunLeader}
                      />{" "}
                      • {formatForumDate(t.createdAt)}
                    </div>
                  </div>
                  <div className="font-mono text-[11px] sm:text-right shrink-0">
                    <div>{t.postCount} yorum</div>
                    <div className="opacity-60">son: {formatForumDate(t.updatedAt)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 font-anton">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-[3px] border-black px-3 py-1 bg-white disabled:opacity-40"
          >
            ←
          </button>
          <span className="font-mono text-[12px]">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="border-[3px] border-black px-3 py-1 bg-white disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </ForumShell>
  );
}
