"use client";

import { useEffect, useState } from "react";
import { formatTrMobileInput } from "@/lib/phone";
import Turnstile, { turnstileEnabled } from "./Turnstile";
import { errorText, inputClass, Notice, postJson, primaryButton, secondaryButton } from "./ui";

type Props = {
  requestUrl: string;
  verifyUrl: string;
  onVerified: (data: Record<string, unknown>) => void;
  submitLabel?: string;
};

/** Phone number → SMS code. Shared by sign-in, sign-up and phone binding. */
export default function PhoneOtpStep({ requestUrl, verifyUrl, onVerified, submitLabel }: Props) {
  const [phone, setPhone] = useState("");
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
    const r = await postJson(requestUrl, { phone, captchaToken: captcha ?? undefined });
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
        ? `Geliştirme ortamı: SMS gönderilmedi, kod ${r.data.devCode}`
        : "Kod SMS ile gönderildi. 5 dakika geçerli.",
    );
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const r = await postJson(verifyUrl, { phone, code });
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
        <span className="font-mono text-[10px]">CEP TELEFONU</span>
        <div className="flex items-stretch">
          <span className="mt-1 border-[3px] border-r-0 border-black px-2 py-2 font-mono text-[14px] bg-[#F2EFE6]">
            +90
          </span>
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="5XX XXX XX XX"
            value={formatTrMobileInput(phone)}
            onChange={(e) => {
              setPhone(e.target.value);
              if (sent) {
                setSent(false);
                setCode("");
              }
            }}
            className={inputClass}
            aria-describedby="phone-help"
          />
        </div>
        <span id="phone-help" className="font-mono text-[10px] opacity-70">
          Numaran herkese açık profilde gösterilmez.
        </span>
      </label>

      {sent && (
        <label className="block">
          <span className="font-mono text-[10px]">SMS KODU</span>
          <input
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className={`${inputClass} tracking-[0.4em] text-[18px]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            aria-label="6 haneli SMS kodu"
          />
        </label>
      )}

      {!sent && <Turnstile onToken={setCaptcha} resetKey={captchaReset} />}
      {info && <Notice tone="info">{info}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {!sent ? (
        <button disabled={busy || needCaptcha} className={primaryButton}>
          {busy ? "GÖNDERİLİYOR…" : "SMS KODU GÖNDER"}
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
