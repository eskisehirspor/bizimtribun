"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import BirthDateSelect from "@/components/auth/BirthDateSelect";
import CodeSignInStep, { useVerifyChannel } from "@/components/auth/CodeSignInStep";
import LegalReadModal from "@/components/auth/LegalReadModal";
import PasswordFields, { passwordReady } from "@/components/auth/PasswordFields";
import TeamPicker from "@/components/auth/TeamPicker";
import { getCityBySlug } from "@/lib/cities";
import KvkkText from "@/components/legal/KvkkText";
import TermsText from "@/components/legal/TermsText";
import { errorText, inputClass, Notice, postJson, primaryButton } from "@/components/auth/ui";
import { safeNextPath } from "@/lib/forum-ui";
import { foldTr } from "@/lib/teams";
import { hintClass, labelClass } from "@/components/ui";
import { LEGAL_DOCS } from "@/lib/legal";
import { formatTrMobileInput } from "@/lib/phone";

type Step = "phone" | "profile" | "team";

const STEPS: { id: Step; label: string }[] = [
  { id: "phone", label: "1. DOĞRULAMA" },
  { id: "profile", label: "2. PROFİL" },
  { id: "team", label: "3. TAKIM" },
];

/** Lower case, Turkish letters folded to ASCII (Şimşek → simsek), no spaces. */
function asciiUsername(value: string) {
  return foldTr(value).replace(/\s+/g, "");
}

function ticketLabel(t: { phoneMasked?: string | null; emailMasked?: string | null }) {
  if (t.emailMasked) return `E-posta doğrulandı: ${t.emailMasked}`;
  if (t.phoneMasked) return `Telefon doğrulandı: ${t.phoneMasked}`;
  return null;
}

function Flow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const preselect = params.get("takim");
  const { user, refresh } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const channel = useVerifyChannel();
  const [verifiedAs, setVerifiedAs] = useState<string | null>(null);
  const [legacyHint, setLegacyHint] = useState(false);
  const [username, setUsername] = useState("");
  const [ticketChannel, setTicketChannel] = useState<"email" | "sms" | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [reading, setReading] = useState<"terms" | "privacy" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/signup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.ticket) return;
        setVerifiedAs(ticketLabel(d));
        setTicketChannel(d.channel ?? null);
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
    setLegacyHint(Boolean(data.legacyAccountHint));
    const t = await fetch("/api/auth/signup", { cache: "no-store" }).then((r) => r.json());
    setVerifiedAs(ticketLabel(t));
    setTicketChannel(t.channel ?? null);
    setStep("profile");
  }

  async function submit(teamId: string, city: string | null) {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/auth/signup", {
      username,
      displayName: null,
      firstName,
      lastName,
      birthDate,
      phone: ticketChannel === "sms" ? null : phone,
      marketingConsent: marketing,
      password,
      city,
      teamId,
      confirmTeamLocked: true,
      acceptTerms: terms,
      acknowledgePrivacy: privacy,
      confirmAge: age,
      termsVersion: LEGAL_DOCS.terms.version,
      privacyVersion: LEGAL_DOCS.privacy.version,
    });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      if (r.status === 401) setStep("phone");
      if (/kullanıcı adı|telefon|doğum|ad soyad|adını|yaşından|şifre/i.test(errorText(r))) setStep("profile");
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
            {channel === "sms"
              ? "Bizim Tribün'de her hesap SMS ile doğrulanmış bir cep telefonuna bağlıdır ve bir telefonla yalnızca bir hesap açılır."
              : "Bizim Tribün'de her hesap doğrulanmış bir e-posta adresine bağlıdır; bir adresle ve bir cihazdan sınırlı sayıda hesap açılır."}{" "}
            Zaten üyeysen{" "}
            <Link href={`/giris?next=${encodeURIComponent(next)}`} className="underline">
              giriş sayfasından
            </Link>{" "}
            gir.
          </p>
          <CodeSignInStep
            channel={channel}
            onVerified={(d) => void onVerified(d)}
            submitLabel="DOĞRULA VE DEVAM ET"
          />
        </>
      )}

      {step === "profile" && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[a-z0-9_]{3,20}$/.test(username)) {
              setError("Takma ad 3–20 karakter olmalı; küçük harf, rakam ve alt çizgi.");
              return;
            }
            if (!passwordReady(password, password2)) {
              setError("Şifre kurallara uymuyor ya da iki şifre aynı değil.");
              return;
            }
            if (firstName.trim().length < 2 || lastName.trim().length < 2) {
              setError("Adını ve soyadını yaz.");
              return;
            }
            if (ticketChannel !== "sms" && phone.replace(/\D/g, "").length < 10) {
              setError("Cep telefonu numaranı 5XX XXX XX XX biçiminde yaz.");
              return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
              setError("Doğum tarihini seç.");
              return;
            }
            const check = await fetch(`/api/auth/username?name=${encodeURIComponent(username)}`)
              .then((r) => r.json() as Promise<{ available?: boolean; error?: string }>)
              .catch(() => null);
            if (check && check.available === false) {
              setError(check.error ?? "Bu takma ad kullanılamaz.");
              return;
            }
            setError(null);
            setStep("team");
          }}
        >
          {verifiedAs && <Notice tone="success">{verifiedAs}</Notice>}
          {legacyHint && (
            <Notice tone="info">
              Bu {channel === "sms" ? "numara" : "adres"} şifreyle açılmış eski bir hesapta da yazılı. O
              hesabı kullanmak istiyorsan{" "}
              <Link className="underline" href="/giris?yontem=sifre">şifrenle giriş yap</Link>. Yeni
              hesap açarsan {channel === "sms" ? "numara" : "adres"} yeni hesaba geçer.
            </Notice>
          )}
          <label className="block">
            <span className={labelClass}>TAKMA AD</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(asciiUsername(e.target.value))}
              className={inputClass}
              autoComplete="username"
              maxLength={20}
              aria-describedby="u-help"
            />
            <span id="u-help" className={hintClass}>
              Forumda ve profilinde görünen tek kimliğin. 3–20 karakter: küçük harf (a-z), rakam (0-9)
              ve alt çizgi (_). Türkçe harfler kendiliğinden çevrilir (ş → s).
            </span>
          </label>
          <fieldset className="block">
            <legend className={labelClass}>AD SOYAD</legend>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                autoComplete="given-name"
                maxLength={40}
                placeholder="Ad"
                aria-label="Ad"
                aria-describedby="name-help"
              />
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                autoComplete="family-name"
                maxLength={40}
                placeholder="Soyad"
                aria-label="Soyad"
                aria-describedby="name-help"
              />
            </div>
            <span id="name-help" className={hintClass}>
              Bu isim hiçbir yerde görünmez. Sitede yalnızca takma adın görünür.
            </span>
          </fieldset>
          {ticketChannel !== "sms" && (
            <label className="block">
              <span className={labelClass}>CEP TELEFONU</span>
              <div className="flex items-stretch">
                <span className="mt-1 inline-flex items-center border-[3px] border-r-0 border-black px-2 py-2 font-mono text-base sm:text-[14px] bg-[#F2EFE6]">
                  +90
                </span>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="5XX XXX XX XX"
                  value={formatTrMobileInput(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  aria-describedby="phone-help"
                />
              </div>
              <span id="phone-help" className={hintClass}>
                Hesabınla ilgili iletişim için. Herkese açık profilde görünmez.
              </span>
            </label>
          )}
          <label className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Bizim Tribün&apos;e özel fırsat ve kampanyalardan SMS ile haberdar olmak istiyorum.
              (İsteğe bağlı, istediğin zaman Hesabım sayfasından geri alabilirsin.)
            </span>
          </label>
          <div className="block">
            <span className={labelClass}>DOĞUM TARİHİ</span>
            <BirthDateSelect value={birthDate} onChange={setBirthDate} describedBy="bday-help" />
            <span id="bday-help" className={hintClass}>
              Yaş sınırı için. 13 yaşından küçükler üye olamaz. Herkese açık görünmez.
            </span>
          </div>
          <PasswordFields
            password={password}
            repeat={password2}
            onPassword={setPassword}
            onRepeat={setPassword2}
          />
          <p className={hintClass}>
            Sonraki girişlerinde e-postan ve bu şifreyle girersin. Şifreni unutursan giriş sayfasındaki
            &quot;Şifremi unuttum&quot; ile e-postana gelen linkten yenisini belirlersin.
          </p>
          <fieldset className="space-y-2 border-[3px] border-black p-3">
            <legend className={`${labelClass} px-1`}>ONAYLAR (HEPSİ ZORUNLU)</legend>
            <label className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => (e.target.checked ? setReading("terms") : setTerms(false))}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <button type="button" onClick={() => setReading("terms")} className="underline">
                  Kullanım Koşulları
                </button>
                &apos;nı okudum ve kabul ediyorum.
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => (e.target.checked ? setReading("privacy") : setPrivacy(false))}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <button type="button" onClick={() => setReading("privacy")} className="underline">
                  KVKK Aydınlatma Metni
                </button>
                &apos;ni okudum; kişisel verilerimin nasıl işlendiği konusunda bilgilendirildim.
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-3 font-mono text-[13px]">
              <input
                type="checkbox"
                checked={age}
                onChange={(e) => setAge(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>18 yaşından büyüğüm ya da 13–17 yaşındayım ve velimin izni var.</span>
            </label>
            <p className={hintClass}>
              Metinlere tıklayıp sonuna kadar okuduktan sonra işaretleyebilirsin. Aydınlatma Metni bir
              rıza metni değildir; üyelik için açık rızan istenmez.
            </p>
          </fieldset>
          {reading && (
            <LegalReadModal
              title={reading === "terms" ? "KULLANIM KOŞULLARI" : "KVKK AYDINLATMA METNİ"}
              onClose={() => setReading(null)}
              onConfirm={() => {
                if (reading === "terms") setTerms(true);
                else setPrivacy(true);
                setReading(null);
              }}
            >
              {reading === "terms" ? <TermsText /> : <KvkkText />}
            </LegalReadModal>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <button disabled={!terms || !privacy || !age} className={primaryButton}>
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
            initialCity={getCityBySlug(params.get("il") ?? "")?.name ?? null}
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
        <h1 className="font-anton text-[40px] leading-[1.05] mt-2 mb-5">
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
