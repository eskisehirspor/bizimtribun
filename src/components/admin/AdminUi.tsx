"use client";

import { useState } from "react";

export function AdminCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="border-[3px] border-black bg-[#FFFEFA] p-3 shadow-[4px_4px_0_black]">
      <p className="font-mono text-[10px] tracking-wide opacity-60">{title}</p>
      <p className="font-anton text-[32px] leading-none mt-1">{value}</p>
    </div>
  );
}

export function AdminNotice({
  kind,
  children,
}: {
  kind: "error" | "empty" | "loading";
  children: React.ReactNode;
}) {
  const bg = kind === "error" ? "bg-[#C8102E]/10" : "bg-[#FFFEFA]";
  return (
    <div className={`border-[3px] border-black border-dashed p-4 font-mono text-[13px] ${bg}`}>
      {children}
    </div>
  );
}

export function AdminPager({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 mt-3 font-mono text-[12px]">
      <span>
        {total} kayıt • sayfa {page}/{pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="border-[2px] border-black px-2 py-1 bg-white disabled:opacity-40"
        >
          ←
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="border-[2px] border-black px-2 py-1 bg-white disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function useConfirmAction() {
  const [open, setOpen] = useState<ConfirmState | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function ask(state: ConfirmState) {
    setReason("");
    setError(null);
    setOpen(state);
  }

  async function confirm() {
    if (!open) return;
    const needsReason = open.requireReason !== false;
    if (needsReason && reason.trim().length < 3) {
      setError("Gerekçe en az 3 karakter olmalı.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await open.onConfirm(reason.trim());
      setOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const dialog = open ? (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[8px_8px_0_black]">
        <h3 className="font-anton text-[24px] leading-none">{open.title}</h3>
        <p className="font-mono text-[12px] mt-2">{open.body}</p>
        <label className="block mt-3">
          <span className="font-mono text-[10px]">
            {open.requireReason === false ? "GEREKÇE (isteğe bağlı)" : "GEREKÇE"}
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full border-[3px] border-black p-2 font-mono text-[13px] min-h-[80px]"
          />
        </label>
        {error && <p className="font-mono text-[12px] text-[#C8102E] mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="font-anton text-[14px] bg-[#C8102E] text-white border-[3px] border-black px-3 py-2"
          >
            {busy ? "…" : open.confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen(null)}
            className="font-anton text-[14px] border-[3px] border-black px-3 py-2 bg-white"
          >
            VAZGEÇ
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}

export async function adminJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "İşlem başarısız.");
  }
  return data;
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
