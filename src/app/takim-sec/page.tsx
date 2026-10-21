"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import PhoneOtpStep from "@/components/auth/PhoneOtpStep";
import TeamPicker from "@/components/auth/TeamPicker";
import { errorText, Notice, postJson } from "@/components/auth/ui";

/** One-time team choice for accounts that exist but have not voted (e.g. older accounts). */
function Flow() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="font-mono text-[12px]">Yükleniyor…</p>;
  if (!user) {
    return (
      <Notice tone="info">
        Takım seçmek için önce <Link className="underline" href="/uye-ol">üye ol</Link> ya da{" "}
        <Link className="underline" href="/giris?next=/takim-sec">giriş yap</Link>.
      </Notice>
    );
  }
  if (user.voteTeamId) {
    return (
      <Notice tone="info">
        Takım seçimin kesinleşmiş ve değiştirilemez. <Link className="underline" href="/hesap">Hesabına dön</Link>
      </Notice>
    );
  }
  if (!user.phoneVerified) {
    return (
      <div className="space-y-3">
        <Notice tone="info">
          Oy vermeden önce cep telefonunu SMS ile doğrulaman gerekiyor. Bir numara yalnızca bir
          hesapta doğrulanabilir.
        </Notice>
        <PhoneOtpStep
          requestUrl="/api/account/phone/request"
          verifyUrl="/api/account/phone/verify"
          submitLabel="TELEFONU DOĞRULA"
          onVerified={() => void refresh()}
        />
      </div>
    );
  }

  async function confirm(teamId: string, city: string | null) {
    setBusy(true);
    setError(null);
    const r = await postJson("/api/fan-vote", { teamId, city, confirmTeamLocked: true });
    setBusy(false);
    if (!r.ok) {
      setError(errorText(r));
      if (r.status === 409) await refresh();
      return;
    }
    await refresh();
    router.push("/hesap");
  }

  return (
    <TeamPicker
      initialTeamId={params.get("takim") ?? user.teamId}
      busy={busy}
      error={error}
      confirmLabel="ONAYLA, OYUMU KESİNLEŞTİR"
      onConfirm={(t, c) => void confirm(t, c)}
    />
  );
}

export default function TakimSecPage() {
  return (
    <ForumShell>
      <div className="max-w-[560px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.2em]">BİZİM TRİBÜN • SAYIM</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2 mb-5">
          TAKIMINI
          <br />
          <span className="bg-[#C8102E] text-white px-2 inline-block rotate-1">SEÇ</span>
        </h1>
        <Suspense fallback={<p className="font-mono text-[12px]">Yükleniyor…</p>}>
          <Flow />
        </Suspense>
      </div>
    </ForumShell>
  );
}
