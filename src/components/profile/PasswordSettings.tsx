"use client";

import { useEffect, useState } from "react";
import PasswordFields, { passwordReady } from "@/components/auth/PasswordFields";
import { errorText, inputClass, Notice, postJson, primaryButton } from "@/components/auth/ui";
import { hintClass, labelClass } from "@/components/ui";

/** Set a first password, or change it (old password, unless just signed in with a code). */
export default function PasswordSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/password", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHasPassword(Boolean(d.hasPassword));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordReady(password, repeat)) {
      setError("Şifre kurallara uymuyor ya da iki şifre aynı değil.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await postJson("/api/account/password", {
      password,
      ...(current ? { currentPassword: current } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    setDone(true);
    setHasPassword(true);
    setCurrent("");
    setPassword("");
    setRepeat("");
  }

  if (hasPassword === null) return <p className="font-mono text-[12px]">Yükleniyor…</p>;

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-3">
      <p className="font-mono text-[12px]">
        {hasPassword
          ? "Şifreni değiştirebilirsin. Şifreni unuttuysan çıkış yapıp e-posta koduyla gir; girişten sonraki 15 dakika içinde eski şifre sorulmaz."
          : "Henüz şifren yok. Bir şifre belirlersen e-postan ve şifrenle giriş yapabilirsin."}
      </p>
      {hasPassword && (
        <label className="block">
          <span className={labelClass}>MEVCUT ŞİFRE</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
            autoComplete="current-password"
            maxLength={128}
          />
          <span className={hintClass}>Az önce kodla girdiysen boş bırakabilirsin.</span>
        </label>
      )}
      <PasswordFields
        password={password}
        repeat={repeat}
        onPassword={setPassword}
        onRepeat={setRepeat}
        label={hasPassword ? "YENİ ŞİFRE" : "ŞİFRE"}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">Şifren kaydedildi.</Notice>}
      <button disabled={busy || !passwordReady(password, repeat)} className={primaryButton}>
        {busy ? "KAYDEDİLİYOR…" : hasPassword ? "ŞİFREYİ DEĞİŞTİR" : "ŞİFREYİ KAYDET"}
      </button>
    </form>
  );
}
