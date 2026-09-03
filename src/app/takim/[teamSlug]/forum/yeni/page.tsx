"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_DEFAULT,
  FORUM_CATEGORY_META,
  isForumCategory,
  tribunTitle,
  type ForumCategory,
} from "@/lib/forum-category";
import {
  FORUM_BODY_MAX,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
} from "@/lib/policy";
import { FORUM_ACTIVE_TEAM_IDS, getTeam } from "@/lib/teams";
import { forumApiError } from "@/lib/forum-ui";

export default function YeniKonuPage() {
  const rawSlug = useParams<{ teamSlug: string }>().teamSlug;
  const teamSlug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || "";
  const router = useRouter();
  const { user, banned, message, loading } = useAuth();
  const team = getTeam(teamSlug);
  const active = FORUM_ACTIVE_TEAM_IDS.includes(teamSlug);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<ForumCategory>(FORUM_CATEGORY_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forumPath = `/takim/${teamSlug}/forum`;
  const yeniPath = `/takim/${teamSlug}/forum/yeni?category=${category}`;
  const loginHref = `/giris?next=${encodeURIComponent(yeniPath)}`;

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("category");
    if (isForumCategory(raw)) setCategory(raw);
  }, []);

  useEffect(() => {
    if (!loading && !user && !banned) {
      router.replace(loginHref);
    }
  }, [loading, user, banned, router, loginHref]);

  const titleOk = useMemo(() => {
    const t = title.replace(/\s+/g, " ").trim();
    return t.length >= FORUM_TITLE_MIN && t.length <= FORUM_TITLE_MAX;
  }, [title]);
  const bodyOk = useMemo(() => {
    const t = content.trim();
    return t.replace(/\s/g, "").length > 0 && t.length <= FORUM_BODY_MAX;
  }, [content]);

  async function publish() {
    if (!titleOk || !bodyOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum/teams/${teamSlug}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.replace(/\s+/g, " ").trim(),
          content: content.trim(),
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(forumApiError(res.status, data.error));
        return;
      }
      router.push(`/forum/konu/${data.topic.id}`);
    } catch {
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  if (!team || !active) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">TRİBÜN YOK</h1>
      </ForumShell>
    );
  }

  if (loading) {
    return (
      <ForumShell>
        <p className="font-mono text-[13px]">…</p>
      </ForumShell>
    );
  }

  if (banned) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">YAZAMAZSIN</h1>
        <p className="font-mono text-[13px] mt-2">{message || "Hesabın askıya alınmış."}</p>
        <Link href={forumPath} className="mt-4 inline-block font-anton border-[3px] border-black px-3 py-2">
          TRİBÜNE DÖN
        </Link>
      </ForumShell>
    );
  }

  if (!user) {
    return (
      <ForumShell>
        <p className="font-mono text-[13px]">Giriş sayfasına yönlendiriliyorsun…</p>
      </ForumShell>
    );
  }

  if (!user.emailVerified) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">E-POSTA GEREKLİ</h1>
        <p className="font-mono text-[13px] mt-2">
          Forumda yazabilmek için e-posta adresini doğrulaman gerekiyor.
        </p>
        <Link
          href="/uye-dogrula"
          className="mt-4 inline-block font-anton border-[3px] border-black bg-[#FFEA00] px-3 py-2"
        >
          DOĞRULA
        </Link>
        <Link href={forumPath} className="mt-4 ml-2 inline-block font-anton border-[3px] border-black px-3 py-2">
          TRİBÜNE DÖN
        </Link>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <Link href={forumPath} className="font-mono text-[11px] underline">
        ← {tribunTitle(team.name)}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <TeamMark team={team} size={44} />
        <h1 className="font-anton text-[32px] leading-[0.85]">YENİ KONU</h1>
      </div>

      <div className="mt-5 bg-[#FFFEFA] border-[4px] border-black shadow-[6px_6px_0_black] p-4 sm:p-5 space-y-3">
        <div>
          <span className="font-mono text-[10px]">KATEGORİ</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {FORUM_CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`font-anton text-[12px] px-3 py-2 border-[3px] border-black ${
                  category === key ? "bg-black text-[#FFEA00]" : "bg-white"
                }`}
              >
                {FORUM_CATEGORY_META[key].tab}
              </button>
            ))}
          </div>
          <p className="font-mono text-[11px] mt-2 opacity-70">
            {FORUM_CATEGORY_META[category].blurb}
          </p>
        </div>
        <label className="block">
          <span className="font-mono text-[10px]">BAŞLIK ({FORUM_TITLE_MIN}–{FORUM_TITLE_MAX})</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, FORUM_TITLE_MAX))}
            className="mt-1 w-full border-[3px] border-black px-3 py-2 font-anton text-[18px] outline-none"
          />
          <span className="font-mono text-[10px] opacity-60">{title.trim().length}/{FORUM_TITLE_MAX}</span>
        </label>
        <label className="block">
          <span className="font-mono text-[10px]">YAZI (MAX {FORUM_BODY_MAX})</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, FORUM_BODY_MAX))}
            rows={10}
            className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none resize-y min-h-[180px]"
          />
          <span className="font-mono text-[10px] opacity-60">{content.length}/{FORUM_BODY_MAX}</span>
        </label>
        {error && (
          <p className="font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !titleOk || !bodyOk}
            onClick={() => void publish()}
            className="flex-1 font-anton text-[16px] py-3 border-[3px] border-black bg-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {busy ? "YAYINLANIYOR…" : "YAYINLA"}
          </button>
          <Link
            href={forumPath}
            className="font-anton text-[16px] py-3 px-4 border-[3px] border-black bg-white grid place-items-center"
          >
            İPTAL
          </Link>
        </div>
      </div>
    </ForumShell>
  );
}
