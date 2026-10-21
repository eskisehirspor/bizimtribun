"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import PhoneOtpStep from "@/components/auth/PhoneOtpStep";
import { forumApiError, safeNextPath } from "@/lib/forum-ui";
import { inputClass, primaryButton, secondaryButton } from "@/components/auth/ui";
import { labelClass } from "@/components/ui";

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { refresh } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [need2fa, setNeed2fa] = useState(params.get("adim") === "2fa");
  const [method, setMethod] = useState<"sms" | "password">(
    params.get("yontem") === "sifre" ? "password" : "sms",
  );
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
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2">
          GİRİŞ
          <br />
          <span className="bg-[#FFEA00] px-2 inline-block rotate-1">YAP</span>
        </h1>
        {method === "sms" && !need2fa && (
          <div className="mt-5">
            <PhoneOtpStep
              requestUrl="/api/auth/otp/request"
              verifyUrl="/api/auth/otp/verify"
              submitLabel="GİRİŞ YAP"
              onVerified={(data) => {
                if (data.next === "signup") {
                  router.push(`/uye-ol?next=${encodeURIComponent(next)}`);
                  return;
                }
                if (data.next === "2fa") {
                  setNeed2fa(true);
                  return;
                }
                void finishLogin();
              }}
            />
            <div className="mt-5 border-t-[2px] border-dashed border-black pt-4">
              <button type="button" onClick={() => setMethod("password")} className={secondaryButton}>
                ŞİFREYLE GİRİŞ YAP
              </button>
              <p className="font-mono text-[12px] mt-1 opacity-70">
                Şifreyle açılmış eski hesaplar ve yöneticiler için.
              </p>
            </div>
          </div>
        )}
        {(method === "password" || need2fa) && (
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
          {!need2fa && (
            <>
          <label className="block">
            <span className={labelClass}>KULLANICI ADI VEYA E-POSTA</span>
            <input
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={inputClass}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className={labelClass}>PAROLA</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </label>
            </>
          )}
          {need2fa && (
            <label className="block">
              <span className={labelClass}>DOĞRULAMA KODU (KİMLİK DOĞRULAMA UYGULAMASI)</span>
              <input
                required
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className={inputClass}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="font-mono text-[13px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
              {error}
            </p>
          )}
          <button disabled={busy} aria-busy={busy || undefined} className={primaryButton}>
            {busy ? (need2fa ? "DOĞRULANIYOR…" : "GİRİŞ YAPILIYOR…") : need2fa ? "DOĞRULA" : "GİRİŞ YAP"}
          </button>
          {!need2fa && (
            <button type="button" onClick={() => setMethod("sms")} className={secondaryButton}>
              SMS KODUYLA GİRİŞ YAP
            </button>
          )}
        </form>
        )}
        <div className="mt-6 border-t-[3px] border-black pt-4">
          <p className="font-mono text-[13px]">Hesabın yok mu?</p>
          <Link className={`mt-2 ${secondaryButton}`} href={`/uye-ol?next=${encodeURIComponent(next)}`}>
            ÜYE OL
          </Link>
          <p className="font-mono text-[12px] mt-3 opacity-70">
            Şifreyle açılmış eski hesaplar oy vermek ve tribünde yazmak için telefonunu bir kez
            doğrulamalı.
          </p>
        </div>
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
