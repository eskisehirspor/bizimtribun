"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { errorText, inputClass, Notice, postJson, secondaryButton } from "@/components/auth/ui";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import MarketingConsentToggle from "@/components/profile/MarketingConsentToggle";
import PasswordSettings from "@/components/profile/PasswordSettings";
import { btnDanger, btnPrimary, labelClass } from "@/components/ui";

const CONFIRM = "HESABIMI SİL";

function Account() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh, logout } = useAuth();
  const catalog = useTeamCatalog();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="font-mono text-[12px]">Yükleniyor…</p>;
  if (!user) {
    return (
      <Notice tone="info">
        Hesabını görmek için <Link className="underline" href="/giris?next=/hesap">giriş yap</Link>.
      </Notice>
    );
  }
  const team = user.voteTeamId ? catalog.getTeam(user.voteTeamId) : undefined;

  async function remove() {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/account/delete", { confirm });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      return;
    }
    await refresh();
    router.push("/");
  }

  return (
    <div className="space-y-5">
      {params.get("hosgeldin") && (
        <Notice tone="success">Hesabın açıldı ve oyun kaydedildi. Tribüne hoş geldin!</Notice>
      )}
      <section className="border-[3px] border-black bg-white p-4">
        <p className={labelClass}>KULLANICI ADI</p>
        <p className="font-anton text-[26px] leading-[1.05]">@{user.username}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
          <dt className="opacity-70">Doğrulama</dt>
          <dd>
            {user.phoneVerified
              ? "Telefon SMS ile doğrulandı"
              : user.emailVerified
                ? "E-posta doğrulandı"
                : "Doğrulanmadı"}
          </dd>
          <dt className="opacity-70">Takım</dt>
          <dd>{team ? `${team.name} (kalıcı)` : "Henüz seçilmedi"}</dd>
        </dl>
        {!user.voteTeamId && (
          <Link
            href="/takim-sec"
            className={`mt-3 ${btnPrimary}`}
          >
            {user.verified ? "TAKIMINI SEÇ" : "HESABINI DOĞRULA VE TAKIM SEÇ"}
          </Link>
        )}
        {team && team.isForumActive && (
          <Link href={`/takim/${team.id}/forum`} className="mt-3 inline-block underline font-mono text-[12px]">
            {team.name} tribününe git
          </Link>
        )}
      </section>

      <section id="profil" className="border-[3px] border-black bg-white p-4 space-y-2">
        <h2 className="font-anton text-[20px]">PROFİL VE BİLDİRİMLER</h2>
        <ProfileSettingsForm username={user.username} />
      </section>

      <section id="sifre" className="border-[3px] border-black bg-white p-4 space-y-2">
        <h2 className="font-anton text-[20px]">ŞİFRE</h2>
        <PasswordSettings />
      </section>

      <section className="border-[3px] border-black bg-white p-4 space-y-2">
        <h2 className="font-anton text-[20px]">KAMPANYA İZNİ</h2>
        <MarketingConsentToggle />
      </section>

      <section className="border-[3px] border-black bg-white p-4 space-y-2">
        <h2 className="font-anton text-[20px]">OTURUM</h2>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void logout().then(() => router.push("/"))}
        >
          ÇIKIŞ YAP
        </button>
      </section>

      <section className="border-[3px] border-[#C8102E] bg-white p-4 space-y-2">
        <h2 className="font-anton text-[20px] text-[#C8102E]">HESABI SİL</h2>
        <p className="font-mono text-[12px] leading-[1.45]">
          Hesabını silersen telefonun, e-postan ve profil bilgilerin silinir; oyun sayımdan
          düşer. Forum yazıların &quot;Silinmiş üye&quot; adıyla kalır. Aynı numarayla oy
          verdiysen 1 yıl, vermediysen 30 gün boyunca yeni hesap açılamaz. Ayrıntılar{" "}
          <Link className="underline" href="/kvkk">aydınlatma metninde</Link>.
        </p>
        <label className="block">
          <span className={labelClass}>ONAY İÇİN “{CONFIRM}” YAZ</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="button"
          disabled={busy || confirm !== CONFIRM}
          onClick={() => void remove()}
          className={`w-full ${btnDanger}`}
        >
          {busy ? "SİLİNİYOR…" : "HESABIMI KALICI OLARAK SİL"}
        </button>
      </section>
    </div>
  );
}

export default function HesapPage() {
  return (
    <ForumShell>
      <div className="max-w-[560px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • HESAP</p>
        <h1 className="font-anton text-[40px] leading-[1.05] mt-2 mb-5">HESABIM</h1>
        <Suspense fallback={<p className="font-mono text-[12px]">Yükleniyor…</p>}>
          <Account />
        </Suspense>
      </div>
    </ForumShell>
  );
}
