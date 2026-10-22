"use client";

import Link from "next/link";
import { useState } from "react";
import ForumShell from "@/components/ForumShell";
import Turnstile, { turnstileEnabled } from "@/components/auth/Turnstile";
import { errorText, inputClass, Notice, postJson, primaryButton, secondaryButton } from "@/components/auth/ui";
import { labelClass } from "@/components/ui";

/** Asks for the address and mails a one-time link to set a new password. */
export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/password-reset", { email, captchaToken: captcha ?? undefined });
    setBusy(false);
    setCaptchaReset((n) => n + 1);
    setCaptcha(null);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    setSent(typeof r.data.message === "string" ? r.data.message : "Link gönderildi.");
  }

  return (
    <ForumShell>
      <div className="max-w-[420px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-6">
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2">
          ŞİFREMİ
          <br />
          <span className="bg-[#FFEA00] px-2 inline-block rotate-1">UNUTTUM</span>
        </h1>
        {sent ? (
          <div className="mt-5 space-y-3">
            <Notice tone="success">{sent}</Notice>
            <p className="font-mono text-[13px]">Linke tıklayıp yeni şifreni iki kez yaz. Link 30 dakika geçerli.</p>
            <Link href="/giris" className={secondaryButton}>
              GİRİŞ SAYFASINA DÖN
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void send(e)} className="mt-5 space-y-3">
            <p className="font-mono text-[13px]">
              Üye olduğun e-postayı yaz. Sana yeni şifreni belirleyeceğin bir link gönderelim.
            </p>
            <label className="block">
              <span className={labelClass}>E-POSTA</span>
              <input
                required
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
            {error && <Notice tone="error">{error}</Notice>}
            <button disabled={busy || (turnstileEnabled() && !captcha)} className={primaryButton}>
              {busy ? "GÖNDERİLİYOR…" : "LİNK GÖNDER"}
            </button>
            <Link href="/giris" className={secondaryButton}>
              GERİ
            </Link>
          </form>
        )}
      </div>
    </ForumShell>
  );
}
