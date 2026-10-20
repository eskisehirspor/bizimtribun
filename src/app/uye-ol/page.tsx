"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import PhoneOtpStep from "@/components/auth/PhoneOtpStep";
import TeamPicker from "@/components/auth/TeamPicker";
import { errorText, inputClass, Notice, postJson, primaryButton } from "@/components/auth/ui";
import { safeNextPath } from "@/lib/forum-ui";
import { hintClass, labelClass } from "@/components/ui";

type Step = "phone" | "profile" | "team";

const STEPS: { id: Step; label: string }[] = [
  { id: "phone", label: "1. TELEFON" },
  { id: "profile", label: "2. PROFİL" },
  { id: "team", label: "3. TAKIM" },
];

function Flow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const preselect = params.get("takim");
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [legacyHint, setLegacyHint] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/signup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ticket) return;
        setPhoneMasked(d.phoneMasked);
        setStep("profile");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) {
    return (
      <div className="space-y-3">
        <Notice tone="info">Zaten giriş yaptın (@{user.username}).</Notice>
        <Link className="underline font-mono text-[12px]" href={user.voteTeamId ? "/hesap" : "/takim-sec"}>
          {user.voteTeamId ? "Hesabına git" : "Takımını seç"}
        </Link>
      </div>
    );
  }

  async function onVerified(data: Record<string, unknown>) {
    if (data.next === "signup") {
      setLegacyHint(Boolean(data.legacyAccountHint));
      const t = await fetch("/api/auth/signup", { cache: "no-store" }).then((r) => r.json());
      setPhoneMasked(t.phoneMasked ?? null);
      setStep("profile");
      return;
    }
    if (data.next === "2fa") {
      router.push(`/giris?next=${encodeURIComponent(next)}&adim=2fa`);
      return;
    }
    await refresh();
    router.push(next);
  }

  async function submit(teamId: string, city: string | null) {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/signup", {
      username,
      displayName: displayName || null,
      city,
      teamId,
      confirmTeamLocked: true,
      acceptTerms: true,
    });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      if (r.status === 401) setStep("phone");
      if (r.status === 409 && /kullanıcı adı/i.test(errorText(r))) setStep("profile");
      return;
    }
    await refresh();
    router.push(`/hesap?hosgeldin=1`);
  }

  return (
    <div>
      <ol className="flex gap-1 font-anton text-[12px] mb-4" aria-label="Kayıt adımları">
        {STEPS.map((s) => (
          <li
            key={s.id}
            aria-current={s.id === step ? "step" : undefined}
            className={`px-2 py-1 border-[2px] border-black ${
              s.id === step ? "bg-black text-[#FFEA00]" : "bg-white"
            }`}
          >
            {s.label}
          </li>
        ))}
      </ol>

      {step === "phone" && (
        <>
          <p className="font-mono text-[12px] mb-3 leading-[1.4]">
            Bizim Tribün&apos;de her hesap SMS ile doğrulanmış bir cep telefonuna bağlıdır ve bir
            telefonla yalnızca bir hesap açılır. Kayıtlıysan aynı adımla giriş yaparsın.
          </p>
          <PhoneOtpStep
            requestUrl="/api/auth/otp/request"
            verifyUrl="/api/auth/otp/verify"
            onVerified={(d) => void onVerified(d)}
            submitLabel="DOĞRULA VE DEVAM ET"
          />
        </>
      )}

      {step === "profile" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[a-z0-9_]{3,20}$/.test(username)) {
              setError("Kullanıcı adı 3–20 karakter olmalı; küçük harf, rakam ve alt çizgi.");
              return;
            }
            setError(null);
            setStep("team");
          }}
        >
          {phoneMasked && <Notice tone="success">Telefon doğrulandı: {phoneMasked}</Notice>}
          {legacyHint && (
            <Notice tone="info">
              Bu numara şifreyle açılmış eski bir hesapta da yazılı. O hesabı kullanmak
              istiyorsan <Link className="underline" href="/giris?yontem=sifre">şifrenle giriş yap</Link>{" "}
              ve telefonunu orada doğrula. Yeni hesap açarsan numara yeni hesaba geçer.
            </Notice>
          )}
          <label className="block">
            <span className={labelClass}>KULLANICI ADI</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
              className={inputClass}
              autoComplete="username"
              maxLength={20}
              aria-describedby="u-help"
            />
            <span id="u-help" className={hintClass}>
              Forumda ve profilinde görünen tek kimliğin. 3–20 karakter: a-z, 0-9, _
            </span>
          </label>
          <label className="block">
            <span className={labelClass}>GÖRÜNEN AD (İSTEĞE BAĞLI)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              maxLength={40}
            />
          </label>
          <label className="flex items-start gap-2 font-mono text-[12px]">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span>
              <Link href="/kullanim-kosullari" className="underline" target="_blank">
                Kullanım koşullarını
              </Link>{" "}
              kabul ediyorum.{" "}
              <Link href="/kvkk" className="underline" target="_blank">
                Aydınlatma metni
              </Link>
            </span>
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <button disabled={!terms} className={primaryButton}>
            TAKIM SEÇİMİNE GEÇ
          </button>
        </form>
      )}

      {step === "team" && (
        <>
          <p className="font-mono text-[12px] mb-3">
            @{username} • Tuttuğun takımı seç. Bir sonraki ekranda seçimini gözden geçirip
            onaylayacaksın.
          </p>
          <TeamPicker
            initialTeamId={preselect}
            busy={busy}
            error={error}
            confirmLabel="ONAYLA VE HESABI AÇ"
            onConfirm={(teamId, city) => void submit(teamId, city)}
          />
        </>
      )}
    </div>
  );
}

export default function UyeOlPage() {
  return (
    <ForumShell>
      <div className="max-w-[560px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2 mb-5">
          TRİBÜNE
          <br />
          <span className="bg-black text-[#FFEA00] px-2 inline-block -rotate-1">KATIL</span>
        </h1>
        <Suspense fallback={<p className="font-mono text-[12px]">Yükleniyor…</p>}>
          <Flow />
        </Suspense>
      </div>
    </ForumShell>
  );
}
