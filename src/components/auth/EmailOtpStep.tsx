"use client";

import { useEffect, useState } from "react";
import Turnstile, { turnstileEnabled } from "./Turnstile";
import { errorText, inputClass, Notice, postJson, primaryButton, secondaryButton } from "./ui";
import { fieldClass, hintClass, labelClass } from "@/components/ui";

type Props = {
  requestUrl: string;
  verifyUrl: string;
  onVerified: (data: Record<string, unknown>) => void;
  submitLabel?: string;
};

/** E-mail address → 6-digit code by mail. Used by sign-in and sign-up. */
export default function EmailOtpStep({ requestUrl, verifyUrl, onVerified, submitLabel }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await postJson(requestUrl, { email, captchaToken: captcha ?? undefined });
    setBusy(false);
    setCaptchaReset((n) => n + 1);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    setSent(true);
    setCooldown(60);
    setInfo(
      typeof r.data.devCode === "string"
        ? `Geliştirme ortamı: e-posta gönderilmedi, kod ${r.data.devCode}`
        : "Kod e-postana gönderildi. 5 dakika geçerli. Gelmediyse spam klasörüne bak.",
    );
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const r = await postJson(verifyUrl, { email, code });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    onVerified(r.data);
  }

  const needCaptcha = turnstileEnabled() && !captcha;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void (sent ? verify() : send());
      }}
      noValidate
    >
      <label className="block">
        <span className={labelClass}>E-POSTA</span>
        <input
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ornek@mail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (sent) {
              setSent(false);
              setCode("");
            }
          }}
          className={inputClass}
          aria-describedby="email-help"
        />
        <span id="email-help" className={`block mt-1 ${hintClass}`}>
          Adresin herkese açık profilde gösterilmez. Geçici e-posta adresleri kabul edilmez.
        </span>
      </label>

      {sent && (
        <label className="block">
          <span className={labelClass}>E-POSTADAKİ KOD</span>
          <input
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`mt-1 ${fieldClass.replace("text-base sm:text-[14px]", "text-[20px]")} tracking-[0.4em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            aria-label="6 haneli e-posta kodu"
          />
        </label>
      )}

      {!sent && <Turnstile onToken={setCaptcha} resetKey={captchaReset} />}
      {info && <Notice tone="info">{info}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {!sent ? (
        <button disabled={busy || needCaptcha} className={primaryButton}>
          {busy ? "GÖNDERİLİYOR…" : "E-POSTAYA KOD GÖNDER"}
        </button>
      ) : (
        <>
          <button disabled={busy || code.length !== 6} className={primaryButton}>
            {busy ? "KONTROL EDİLİYOR…" : (submitLabel ?? "DOĞRULA")}
          </button>
          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => {
              setSent(false);
              setCode("");
            }}
            className={secondaryButton}
          >
            {cooldown > 0 ? `YENİ KOD (${cooldown} sn)` : "YENİ KOD İSTE"}
          </button>
        </>
      )}
    </form>
  );
}
