"use client";

import { useState } from "react";
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

export function LikeButton({
  type,
  id,
  count,
  liked,
  canLike,
}: {
  type: "topic" | "post";
  id: number;
  count: number;
  liked: boolean;
  /** False for guests, unverified accounts and the author. */
  canLike: boolean;
}) {
  const [state, setState] = useState({ count, liked });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={!canLike || busy}
        aria-pressed={state.liked}
        title={canLike ? (state.liked ? "Beğeniyi geri al" : "Beğen") : "Beğenmek için doğrulanmış hesapla giriş yap"}
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
        className={`font-anton text-[11px] border-[2px] border-black px-2 py-0.5 ${
          state.liked ? "bg-[#FFEA00]" : "bg-white"
        } disabled:opacity-60`}
      >
        👏 {state.count}
      </button>
      {error && <span className="font-mono text-[10px]">{error}</span>}
    </span>
  );
}

export function ReportButton({ type, id }: { type: "topic" | "post" | "user"; id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) return <span className="font-mono text-[10px]">{done}</span>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-mono text-[10px] underline">
        Bildir
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="border-[2px] border-black bg-white px-1"
        aria-label="Bildirim sebebi"
      >
        <option value="">Sebep seç</option>
        {REASONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        placeholder="not (isteğe bağlı)"
        className="border-[2px] border-black px-1 w-[150px]"
      />
      <button
        type="button"
        disabled={!reason || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post("/api/forum/reports", { type, id, reason, note: note || undefined });
            setDone("Bildirildi. Moderatörler inceleyecek.");
          } catch (err) {
            setDone(err instanceof Error ? err.message : "Gönderilemedi.");
          } finally {
            setBusy(false);
          }
        }}
        className="font-anton border-[2px] border-black px-2 bg-black text-white disabled:opacity-50"
      >
        GÖNDER
      </button>
      <button type="button" onClick={() => setOpen(false)} className="underline">
        vazgeç
      </button>
    </span>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`@${username} engellensin mi? Yazılarını görmezsin, sana bildirim gönderemez.`)) return;
          setBusy(true);
          setError(null);
          try {
            await post("/api/account/blocks", { userId, blocked: true });
            onBlocked?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Olmadı.");
          } finally {
            setBusy(false);
          }
        }}
        className="font-mono text-[10px] underline"
      >
        Engelle
      </button>
      {error && <span className="font-mono text-[10px]">{error}</span>}
    </>
  );
}
