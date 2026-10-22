"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LegalReadModal from "@/components/auth/LegalReadModal";
import KvkkText from "@/components/legal/KvkkText";
import TermsText from "@/components/legal/TermsText";
import { btnPrimary, btnSecondary } from "@/components/ui";

/**
 * Shown to signed-in members when the terms or the KVKK notice changed since
 * they last accepted. Writing in the forum is refused on the server until
 * they accept; on the legal pages themselves it stays a bar so they can read.
 */
export default function LegalGate() {
  const { user, legalPending, refresh, logout } = useAuth();
  const pathname = usePathname();
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!user || legalPending.length === 0 || pathname.startsWith("/admin")) return null;
  const reading = legalPending.some((d) => pathname === d.path) || pathname === "/cerez-politikasi";
  const all = legalPending.every((d) => ticked[d.doc]);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/legal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: legalPending.map((d) => ({ doc: d.doc, version: d.version })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi. Tekrar dene.");
        await refresh();
        return;
      }
      setTicked({});
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const panel = (
    <div
      role={reading ? "region" : "dialog"}
      aria-modal={reading ? undefined : true}
      aria-labelledby="legal-gate-title"
      className="w-full max-w-[560px] border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[6px_6px_0_black]"
    >
      <p id="legal-gate-title" className="font-anton text-[22px] leading-none">
        METİNLERİMİZ GÜNCELLENDİ
      </p>
      <p className="mt-2 font-mono text-[13px]">
        Devam etmeden önce güncel metinleri okuyup onaylaman gerekiyor. Onaylamadan forumda yazamazsın.
      </p>
      <div className="mt-3 space-y-2">
        {legalPending.map((d) => (
          <label key={d.doc} className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
            <input
              type="checkbox"
              checked={Boolean(ticked[d.doc])}
              onChange={(e) =>
                e.target.checked ? setOpen(d.doc) : setTicked((t) => ({ ...t, [d.doc]: false }))
              }
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              {d.label}{" "}
              <button type="button" onClick={() => setOpen(d.doc)} className="underline">
                Metni oku ({d.version})
              </button>
            </span>
          </label>
        ))}
      </div>
      {open && (
        <LegalReadModal
          title={open === "terms" ? "KULLANIM KOŞULLARI" : "KVKK AYDINLATMA METNİ"}
          onClose={() => setOpen(null)}
          onConfirm={() => {
            setTicked((t) => ({ ...t, [open]: true }));
            setOpen(null);
          }}
        >
          {open === "terms" ? <TermsText /> : <KvkkText />}
        </LegalReadModal>
      )}
      {error && <p className="mt-2 font-mono text-[13px] text-[#C8102E]">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!all || busy} onClick={() => void accept()} className={btnPrimary}>
          {busy ? "KAYDEDİLİYOR…" : "ONAYLA VE DEVAM ET"}
        </button>
        <button type="button" disabled={busy} onClick={() => void logout()} className={btnSecondary}>
          ÇIKIŞ YAP
        </button>
      </div>
    </div>
  );

  if (reading) {
    return <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">{panel}</div>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">{panel}</div>
  );
}
