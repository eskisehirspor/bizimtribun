"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

function Panel() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading, refresh } = useAuth();
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("err");
        setError(data.error || "Doğrulanamadı.");
        return;
      }
      window.history.replaceState(null, "", "/uye-dogrula");
      await refresh();
      setState("ok");
    } catch {
      setState("err");
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gönderilemedi.");
        return;
      }
      setMessage(data.message || "Mail gönderildi.");
    } catch {
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  const verified = Boolean(user?.emailVerified);

  return (
    <main className="min-h-screen bg-[#F2EFE6] paper-bg flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-[#FFFEFA] border-[4px] border-black shadow-[12px_12px_0_black] p-7 -rotate-[0.5deg]">
        <div className="font-mono text-[10px] tracking-[0.2em]">
          BİZİM TRİBÜN • ÜYELİK
        </div>
        <h1 className="font-anton text-[40px] leading-none mt-2">
          E-POSTA
          <br />
          DOĞRULA
        </h1>

        {state === "ok" || verified ? (
          <>
            <p className="font-mono text-[14px] mt-4">
              E-posta adresin doğrulandı. Tribünde yazabilirsin.
            </p>
            <Link
              href="/takimlar"
              className="mt-5 inline-block font-anton border-[3px] border-black bg-[#FFEA00] px-4 py-2"
            >
              TRİBÜNLERE GİT
            </Link>
          </>
        ) : token ? (
          <>
            <p className="font-mono text-[14px] mt-4">
              Mailindeki bağlantıyı onayla. Link tek kullanımlık.
            </p>
            {error && (
              <p className="mt-3 font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
              className="mt-5 font-anton text-[16px] border-[3px] border-black bg-black text-white px-4 py-2 disabled:bg-zinc-300"
            >
              {busy ? "…" : "DOĞRULA"}
            </button>
          </>
        ) : (
          <>
            <p className="font-mono text-[14px] mt-4">
              Forumda konu veya yorum yazmak için e-posta adresini doğrulaman
              gerekiyor. Maildeki linke tıkla veya yeni mail iste.
            </p>
            {message && (
              <p className="mt-3 font-mono text-[12px] border-[2px] border-black p-2 bg-[#FFEA00]/40">
                {message}
              </p>
            )}
            {error && (
              <p className="mt-3 font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
                {error}
              </p>
            )}
            {!loading && user ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resend()}
                className="mt-5 font-anton text-[16px] border-[3px] border-black bg-[#FFEA00] px-4 py-2 disabled:opacity-50"
              >
                {busy ? "…" : "YENİ DOĞRULAMA MAİLİ"}
              </button>
            ) : (
              <p className="font-mono text-[13px] mt-4">
                Maildeki linki kullan veya{" "}
                <Link href="/giris?next=/uye-dogrula" className="underline">
                  giriş yap
                </Link>
                .
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function UyeDogrulaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Panel />
    </Suspense>
  );
}
