"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import TeamBoardGate from "@/components/forum/TeamBoardGate";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_DEFAULT,
  FORUM_CATEGORY_META,
  isForumCategory,
  type ForumCategory,
} from "@/lib/forum-category";
import {
  FORUM_BODY_MAX,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
} from "@/lib/policy";
import { forumApiError } from "@/lib/forum-ui";
import BackLink from "@/components/BackLink";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  btnAccent,
  btnPrimary,
  btnSecondary,
  chipClass,
  fieldClass,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui";

type Props = {
  apiPath: string;
  boardPath: string;
  boardTitle: string;
  active: boolean;
  mark?: React.ReactNode;
  /** Set on team tribunes, which only that team's fans (and staff) may use. */
  teamId?: string;
};

/** New-topic form shared by every board. */
export default function ForumNewTopicView({ apiPath, boardPath, boardTitle, active, mark, teamId }: Props) {
  const router = useRouter();
  const { user, banned, message, loading } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<ForumCategory>(FORUM_CATEGORY_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const forumPath = boardPath;
  const yeniPath = `${boardPath}/yeni?category=${category}`;
  const loginHref = `/giris?next=${encodeURIComponent(yeniPath)}`;

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("category");
    if (isForumCategory(raw)) void Promise.resolve(raw).then(setCategory);
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
  const titleLength = title.replace(/\s+/g, " ").trim().length;
  const titleHint =
    titleLength < FORUM_TITLE_MIN
      ? `Başlık en az ${FORUM_TITLE_MIN} karakter olmalı (${FORUM_TITLE_MIN - titleLength} karakter daha).`
      : null;
  const bodyHint = bodyOk ? null : "Yazı boş olamaz.";
  const dirty = Boolean(title.trim() || content.trim());

  // Warn before a reload or tab close throws the draft away.
  useEffect(() => {
    if (!dirty || busy) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty, busy]);

  function leave(e?: React.MouseEvent) {
    if (!dirty) return;
    e?.preventDefault();
    setLeaving(true);
  }

  async function publish() {
    if (busy) return;
    setTried(true);
    if (!titleOk || !bodyOk) {
      setError(titleHint ?? bodyHint ?? "Başlık ve yazı gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiPath, {
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

  if (!active) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">TRİBÜN YOK</h1>
      </ForumShell>
    );
  }

  if (loading) {
    return (
      <ForumShell>
        <p className="font-mono text-[14px]" aria-busy="true">
          Yükleniyor…
        </p>
      </ForumShell>
    );
  }

  if (banned) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">YAZAMAZSIN</h1>
        <p className="font-mono text-[14px] mt-2">{message || "Hesabın askıya alınmış."}</p>
        <Link href={forumPath} className={`mt-4 ${btnSecondary}`}>
          ← TRİBÜNE DÖN
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

  if (teamId && user.voteTeamId !== teamId) {
    return <TeamBoardGate title={boardTitle} next={boardPath} />;
  }

  if (!user.phoneVerified) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">TELEFON DOĞRULAMASI GEREKLİ</h1>
        <p className="font-mono text-[14px] mt-2">
          Tribünde yazabilmek için telefon numaranı SMS koduyla bir kez doğrulaman gerekiyor.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/takim-sec" className={btnAccent}>
            TELEFONUNU DOĞRULA
          </Link>
          <Link href={forumPath} className={btnSecondary}>
            ← TRİBÜNE DÖN
          </Link>
        </div>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <span onClickCapture={leave}>
        <BackLink href={forumPath}>{boardTitle}</BackLink>
      </span>
      <div className="mt-2 flex items-center gap-3">
        {mark}
        <h1 className="font-anton text-[32px] leading-[0.85]">YENİ KONU</h1>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
        className="mt-5 bg-[#FFFEFA] border-[4px] border-black shadow-[6px_6px_0_black] p-4 sm:p-5 space-y-4"
      >
        <div>
          <span className={labelClass} id="kategori-baslik">
            KATEGORİ
          </span>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby="kategori-baslik">
            {FORUM_CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
                className={chipClass(category === key)}
              >
                {FORUM_CATEGORY_META[key].tab}
              </button>
            ))}
          </div>
          <p className={`${hintClass} mt-2`}>{FORUM_CATEGORY_META[category].blurb}</p>
        </div>
        <label className="block">
          <span className={labelClass}>
            BAŞLIK ({FORUM_TITLE_MIN}–{FORUM_TITLE_MAX} karakter)
          </span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value.slice(0, FORUM_TITLE_MAX));
              setError(null);
            }}
            aria-invalid={tried && !titleOk ? true : undefined}
            aria-describedby="baslik-ipucu"
            className={`mt-1 ${titleField}`}
          />
          <span id="baslik-ipucu" className="font-mono text-[12px] mt-1 flex flex-wrap justify-between gap-2">
            <span className={tried && titleHint ? "text-[#C8102E] font-bold" : "opacity-70"}>
              {titleHint ?? "Başlık uygun."}
            </span>
            <span className="tabular-nums opacity-70">
              {titleLength}/{FORUM_TITLE_MAX}
            </span>
          </span>
        </label>
        <label className="block">
          <span className={labelClass}>YAZI (en çok {FORUM_BODY_MAX} karakter)</span>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, FORUM_BODY_MAX));
              setError(null);
            }}
            rows={10}
            aria-invalid={tried && !bodyOk ? true : undefined}
            aria-describedby="yazi-ipucu"
            className={`${inputClass} resize-y min-h-[180px]`}
          />
          <span id="yazi-ipucu" className="font-mono text-[12px] mt-1 flex flex-wrap justify-between gap-2">
            <span className={tried && bodyHint ? "text-[#C8102E] font-bold" : "opacity-70"}>{bodyHint ?? ""}</span>
            <span className="tabular-nums opacity-70">
              {content.length}/{FORUM_BODY_MAX}
            </span>
          </span>
        </label>
        {error && (
          <p
            role="alert"
            className="font-mono text-[13px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10"
          >
            {error}
          </p>
        )}
        <p className={hintClass}>Yayınladıktan sonra konu düzenlenemez. İstersen silebilirsin.</p>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <Link href={forumPath} onClick={leave} className={btnSecondary}>
            İPTAL
          </Link>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy || undefined}
            className={`${btnPrimary} sm:flex-1`}
          >
            {busy ? "YAYINLANIYOR…" : "YAYINLA"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={leaving}
        title="TASLAK SİLİNSİN Mİ?"
        body="Yazdıkların kaydedilmedi. Çıkarsan başlık ve yazı kaybolur."
        confirmLabel="TASLAĞI SİL VE ÇIK"
        cancelLabel="YAZMAYA DEVAM ET"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          setTitle("");
          setContent("");
          router.push(forumPath);
        }}
      />
    </ForumShell>
  );
}

const titleField = fieldClass.replace("font-mono text-base sm:text-[14px]", "font-anton text-[20px]");
