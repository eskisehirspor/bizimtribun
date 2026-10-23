"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btnDanger, btnPrimary, btnSecondary } from "@/components/ui";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown on the confirm button while the action runs, e.g. "SİLİNİYOR…". */
  busyLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra fields (e.g. a reason box). The first field gets focus. */
  children?: React.ReactNode;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible confirmation dialog: role="dialog", aria-modal, Esc and
 * backdrop close, focus moves in and returns to the trigger afterwards,
 * Tab stays inside.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "VAZGEÇ",
  busyLabel,
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  const busyRef = useRef(busy);

  useEffect(() => {
    cancel.current = onCancel;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const field = panel.current?.querySelector<HTMLElement>("input, textarea, select");
    (field ?? cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!busyRef.current) cancel.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  // Portal to <body> so page stacking contexts can't put the header above the overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black/60 flex items-end sm:items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={body ? `${id}-b` : undefined}
        aria-busy={busy || undefined}
        className="w-full max-w-[460px] border-[4px] border-black bg-[#FFFEFA] text-black p-5 shadow-[8px_8px_0_black]"
      >
        <h2 id={`${id}-t`} className="font-anton text-[26px] leading-[1.05]">
          {title}
        </h2>
        {body ? (
          <div id={`${id}-b`} className="font-mono text-[14px] leading-[1.45] mt-3">
            {body}
          </div>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
        {error ? (
          <p role="alert" className="font-mono text-[13px] text-[#C8102E] mt-3">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${btnSecondary} sm:flex-1`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
            className={`${tone === "danger" ? btnDanger : btnPrimary} sm:flex-1`}
          >
            {busy ? (busyLabel ?? "İŞLENİYOR…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type AskOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

/**
 * Promise-style confirm for simple yes/no questions:
 * `if (!(await confirm({...}))) return;` and render `dialog` once.
 */
export function useConfirm() {
  const [state, setState] = useState<(AskOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: AskOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title ?? ""}
      body={state?.body}
      confirmLabel={state?.confirmLabel ?? "TAMAM"}
      cancelLabel={state?.cancelLabel}
      tone={state?.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}
