"use client";

import Link from "next/link";
import { useId, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  btnGhost,
  btnSm,
  btnSmPrimary,
  inputClass,
  labelClass,
} from "@/components/ui";
import { forumApiError } from "@/lib/forum-ui";

const REASONS: [string, string][] = [
  ["hakaret", "Hakaret / küfür"],
  ["nefret", "Nefret söylemi / ayrımcılık"],
  ["spam", "Spam / reklam"],
  ["kisisel_veri", "Kişisel bilgi paylaşımı"],
  ["siddet", "Şiddet / tehdit"],
  ["diger", "Diğer"],
];

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(forumApiError(res.status, data.error));
  return data;
}

const likeBase =
  "inline-flex min-h-10 items-center justify-center gap-1.5 px-3 font-anton text-[14px] border-[3px] border-black disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FFEA00]";

/** Who is looking at a like button. */
export type LikeViewer = "can" | "author" | "guest" | "unverified" | "none";

export function LikeButton({
  type,
  id,
  count,
  liked,
  viewer,
  loginNext,
}: {
  type: "topic" | "post";
  id: number;
  count: number;
  liked: boolean;
  /** "can": verified member who is not the author. Others see a count or a sign-in link. */
  viewer: LikeViewer;
  /** Page to come back to after signing in. */
  loginNext?: string;
}) {
  const [state, setState] = useState({ count, liked });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `👏 ${state.liked ? "Alkışladın" : "Alkışla"} · ${state.count}`;

  if (viewer === "author" || viewer === "none") {
    return (
      <span className="inline-flex min-h-10 items-center font-mono text-[13px]" aria-label={`${state.count} alkış`}>
        👏 {state.count} alkış
      </span>
    );
  }
  if (viewer === "guest") {
    return (
      <Link
        href={`/giris?next=${encodeURIComponent(loginNext ?? "/")}`}
        className={`${likeBase} bg-white hover:bg-[#FFEA00]/40`}
        title="Alkışlamak için giriş yap"
      >
        👏 Alkışla · {state.count}
      </Link>
    );
  }
  if (viewer === "unverified") {
    return (
      <Link href="/takim-sec" className={`${likeBase} bg-white hover:bg-[#FFEA00]/40`} title="Alkışlamak için telefonunu doğrula">
        👏 Alkışla · {state.count}
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        aria-pressed={state.liked}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const data = await post("/api/forum/likes", { type, id, liked: !state.liked });
            setState({ count: data.likeCount, liked: data.likedByMe });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Olmadı.");
          } finally {
            setBusy(false);
          }
        }}
        className={`${likeBase} ${state.liked ? "bg-[#FFEA00]" : "bg-white hover:bg-[#FFEA00]/40"}`}
      >
        {label}
      </button>
      {error && (
        <span role="alert" className="font-mono text-[12px]">
          {error}
        </span>
      )}
    </span>
  );
}

export function ReportButton({ type, id }: { type: "topic" | "post" | "user"; id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();

  if (done) {
    return (
      <span role="status" className="inline-flex min-h-10 items-center font-mono text-[13px]">
        {done}
      </span>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnGhost} aria-expanded={false}>
        Bildir
      </button>
    );
  }
  return (
    <div className="basis-full w-full max-w-[460px] border-[3px] border-black bg-white p-3 space-y-2">
      <p className="font-anton text-[16px]">BU İÇERİĞİ BİLDİR</p>
      <label className="block" htmlFor={`${fieldId}-r`}>
        <span className={labelClass}>Sebep</span>
        <select
          id={`${fieldId}-r`}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(null);
          }}
          className={inputClass}
        >
          <option value="">Sebep seç</option>
          {REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="block" htmlFor={`${fieldId}-n`}>
        <span className={labelClass}>Not (isteğe bağlı)</span>
        <input
          id={`${fieldId}-n`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="font-mono text-[13px] text-[#C8102E]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={async () => {
            if (!reason) {
              setError("Bir sebep seç.");
              return;
            }
            setBusy(true);
            try {
              await post("/api/forum/reports", { type, id, reason, note: note || undefined });
              setDone("Bildirildi. Moderatörler inceleyecek.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gönderilemedi.");
            } finally {
              setBusy(false);
            }
          }}
          className={btnSmPrimary}
        >
          {busy ? "GÖNDERİLİYOR…" : "BİLDİRİMİ GÖNDER"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnSm}>
          VAZGEÇ
        </button>
      </div>
    </div>
  );
}

export function BlockButton({
  userId,
  username,
  onBlocked,
}: {
  userId: number;
  username: string;
  onBlocked?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setAsking(true)} className={btnGhost}>
        Engelle
      </button>
      <ConfirmDialog
        open={asking}
        title={`@${username} ENGELLENSİN Mİ?`}
        body={
          <>
            <p>Yazılarını görmezsin, sana bildirim gönderemez.</p>
            <p className="mt-2 opacity-80">
              Engellemeyi Hesabım → Engellediklerim bölümünden kaldırabilirsin.
            </p>
          </>
        }
        confirmLabel="ENGELLE"
        busyLabel="ENGELLENİYOR…"
        busy={busy}
        error={error}
        onCancel={() => {
          setAsking(false);
          setError(null);
        }}
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await post("/api/account/blocks", { userId, blocked: true });
            setAsking(false);
            onBlocked?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Olmadı.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
