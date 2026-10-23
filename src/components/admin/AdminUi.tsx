"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { inputClass, labelClass } from "@/components/ui";

export function AdminCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  /** How the number is counted. */
  hint?: string;
}) {
  return (
    <div className="border-[3px] border-black bg-[#FFFEFA] p-3 shadow-[4px_4px_0_black]">
      <p className="font-mono text-[12px] tracking-wide opacity-70">{title}</p>
      <p className="font-anton text-[32px] leading-[1.05] mt-1">{value}</p>
      {hint && <p className="font-mono text-[11px] leading-tight opacity-70 mt-1">{hint}</p>}
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
  return <Pager page={page} pages={pages} onPage={onPage} summary={`${total} kayıt`} />;
}

type ConfirmState = {
  title: string;
  body: string;
  confirmLabel: string;
  /** Verb shown while the action runs, e.g. "SİLİNİYOR…". */
  busyLabel?: string;
  tone?: "danger" | "primary";
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

  const dialog = (
    <ConfirmDialog
      open={Boolean(open)}
      title={open?.title ?? ""}
      body={open?.body}
      confirmLabel={open?.confirmLabel ?? "TAMAM"}
      busyLabel={open?.busyLabel}
      tone={open?.tone ?? "danger"}
      busy={busy}
      error={error}
      onConfirm={() => void confirm()}
      onCancel={() => setOpen(null)}
    >
      <label className="block">
        <span className={labelClass}>
          {open?.requireReason === false ? "GEREKÇE (isteğe bağlı)" : "GEREKÇE (en az 3 karakter)"}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${inputClass} min-h-[96px]`}
        />
      </label>
    </ConfirmDialog>
  );

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
