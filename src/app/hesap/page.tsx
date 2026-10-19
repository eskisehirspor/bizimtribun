"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { errorText, inputClass, Notice, postJson, secondaryButton } from "@/components/auth/ui";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";

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
        <p className="font-mono text-[10px]">KULLANICI ADI</p>
        <p className="font-anton text-[26px] leading-none">@{user.username}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12px]">
          <dt className="opacity-70">Telefon</dt>
          <dd>{user.phoneVerified ? "SMS ile doğrulandı" : "Doğrulanmadı"}</dd>
          <dt className="opacity-70">Takım</dt>
          <dd>{team ? `${team.name} (kalıcı)` : "Henüz seçilmedi"}</dd>
        </dl>
        {!user.voteTeamId && (
          <Link
            href="/takim-sec"
            className="mt-3 inline-block font-anton text-[14px] px-3 py-2 border-[3px] border-black bg-black text-white"
          >
            {user.phoneVerified ? "TAKIMINI SEÇ" : "TELEFONU DOĞRULA VE TAKIM SEÇ"}
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
          düşer. Forum yazıların &quot;Silinmiş üye&quot; adıyla kalır. Aynı numarayla 30 gün
          boyunca yeni hesap açılamaz. Ayrıntılar{" "}
          <Link className="underline" href="/kvkk">aydınlatma metninde</Link>.
        </p>
        <label className="block">
          <span className="font-mono text-[10px]">ONAY İÇİN “{CONFIRM}” YAZ</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          type="button"
          disabled={busy || confirm !== CONFIRM}
          onClick={() => void remove()}
          className="w-full font-anton text-[16px] py-2 border-[3px] border-black bg-[#C8102E] text-white disabled:opacity-40"
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
        <p className="font-mono text-[10px] tracking-[0.2em]">BİZİM TRİBÜN • HESAP</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2 mb-5">HESABIM</h1>
        <Suspense fallback={<p className="font-mono text-[12px]">Yükleniyor…</p>}>
          <Account />
        </Suspense>
      </div>
    </ForumShell>
  );
}
