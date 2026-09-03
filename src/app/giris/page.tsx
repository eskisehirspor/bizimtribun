"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { forumApiError, safeNextPath } from "@/lib/forum-ui";

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { refresh } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishLogin() {
    await refresh();
    router.push(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (need2fa) {
        const res = await fetch("/api/auth/login/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: totp }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(forumApiError(res.status, data.error));
          return;
        }
        await finishLogin();
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(forumApiError(res.status, data.error));
        return;
      }
      if (data.need2fa) {
        setNeed2fa(true);
        setTotp("");
        return;
      }
      await finishLogin();
    } catch {
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForumShell>
      <div className="max-w-[420px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-6">
        <p className="font-mono text-[10px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2">
          GİRİŞ
          <br />
          <span className="bg-[#FFEA00] px-2 inline-block rotate-1">YAP</span>
        </h1>
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
          {!need2fa && (
            <>
          <label className="block">
            <span className="font-mono text-[10px]">KULLANICI ADI VEYA E-POSTA</span>
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px]">PAROLA</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none"
              autoComplete="current-password"
            />
          </label>
            </>
          )}
          {need2fa && (
            <label className="block">
              <span className="font-mono text-[10px]">DOĞRULAMA KODU</span>
              <input
                required
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[16px] outline-none"
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </label>
          )}
          {error && (
            <p className="font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full font-anton text-[18px] py-3 border-[3px] border-black bg-black text-white disabled:bg-zinc-300"
          >
            {busy ? "…" : need2fa ? "DOĞRULA" : "GİRİŞ YAP"}
          </button>
        </form>
        <p className="font-mono text-[12px] mt-4">
          Hesabın yok mu?{" "}
          <Link className="underline" href={`/uye-ol?next=${encodeURIComponent(next)}`}>
            Üye ol
          </Link>
        </p>
      </div>
    </ForumShell>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Form />
    </Suspense>
  );
}
