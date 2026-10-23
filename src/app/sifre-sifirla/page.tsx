"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ForumShell from "@/components/ForumShell";
import PasswordFields, { passwordReady } from "@/components/auth/PasswordFields";
import { errorText, Notice, postJson, primaryButton, secondaryButton } from "@/components/auth/ui";

/** Opened from the reset mail: new password, typed twice. */
function Form() {
  const params = useSearchParams();
  const [token] = useState(() => params.get("token") || "");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordReady(password, repeat)) {
      setError("Şifre kurallara uymuyor ya da iki şifre aynı değil.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/password-reset/confirm", { token, password });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    window.history.replaceState(null, "", "/sifre-sifirla");
    setDone(true);
  }

  return (
    <ForumShell>
      <div className="max-w-[420px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-6">
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[1.05] mt-2">
          YENİ
          <br />
          <span className="bg-[#FFEA00] px-2 inline-block rotate-1">ŞİFRE</span>
        </h1>
        {done ? (
          <div className="mt-5 space-y-3">
            <Notice tone="success">Şifren kaydedildi. Artık e-postan ve bu şifreyle girebilirsin.</Notice>
            <Link href="/giris" className={primaryButton}>
              GİRİŞ YAP
            </Link>
          </div>
        ) : !token ? (
          <div className="mt-5 space-y-3">
            <Notice tone="error">Link eksik. Maildeki düğmeye tekrar tıkla ya da yeni link iste.</Notice>
            <Link href="/sifremi-unuttum" className={secondaryButton}>
              YENİ LİNK İSTE
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void save(e)} className="mt-5 space-y-3">
            <PasswordFields password={password} repeat={repeat} onPassword={setPassword} onRepeat={setRepeat} />
            {error && <Notice tone="error">{error}</Notice>}
            <button disabled={busy || !passwordReady(password, repeat)} className={primaryButton}>
              {busy ? "KAYDEDİLİYOR…" : "ŞİFREMİ KAYDET"}
            </button>
            {error && (
              <Link href="/sifremi-unuttum" className={secondaryButton}>
                YENİ LİNK İSTE
              </Link>
            )}
          </form>
        )}
      </div>
    </ForumShell>
  );
}

export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Form />
    </Suspense>
  );
}
