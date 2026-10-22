"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEGAL_PROSE } from "@/components/LegalPage";

/**
 * Shows a legal text in a dialog. The confirm button unlocks only once the
 * reader has scrolled to the end, so the matching checkbox can only be ticked
 * after the whole text has been on screen.
 */
export default function LegalReadModal({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  const check = useCallback(() => {
    const el = box.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setAtEnd(true);
  }, []);

  useEffect(() => {
    check();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [check, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col border-[4px] border-black bg-[#FFFEFA] shadow-[8px_8px_0_black]">
        <div className="flex items-center justify-between gap-3 border-b-[4px] border-black bg-black px-4 py-3">
          <h2 className="font-anton text-[20px] leading-none text-[#FFEA00]">{title}</h2>
          <button type="button" onClick={onClose} className="font-mono text-[12px] text-white underline">
            KAPAT
          </button>
        </div>
        <div ref={box} onScroll={check} className={`flex-1 overflow-y-auto px-4 py-4 ${LEGAL_PROSE}`}>
          {children}
        </div>
        <div className="border-t-[4px] border-black p-3">
          <button
            type="button"
            disabled={!atEnd}
            onClick={onConfirm}
            className="w-full bg-black py-3 font-anton text-[18px] text-white disabled:opacity-40"
          >
            {atEnd ? "OKUDUM, ONAYLIYORUM" : "SONUNA KADAR OKU ↓"}
          </button>
        </div>
      </div>
    </div>
  );
}
