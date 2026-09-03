"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNotice, adminJson } from "@/components/admin/AdminUi";

type Status = {
  enabled: boolean;
  remainingRecoveryCodes: number;
};

type Setup = {
  secret: string;
  otpauthUrl: string;
};

export default function AdminSecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setStatus(await adminJson<Status>("/api/admin/security/totp"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setRecovery(null);
    try {
      const data = await adminJson<Setup>("/api/admin/security/totp/setup", {
        method: "POST",
        body: "{}",
      });
      setSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kurulum başlatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await adminJson<{ recoveryCodes: string[] }>(
        "/api/admin/security/totp/verify",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      );
      setRecovery(data.recoveryCodes);
      setSetup(null);
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod hatalı.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("2FA kapatılacak. Devam edilsin mi?")) return;
    setBusy(true);
    setError(null);
    try {
      await adminJson("/api/admin/security/totp/disable", {
        method: "POST",
        body: JSON.stringify({ password, code: disableCode }),
      });
      setPassword("");
      setDisableCode("");
      setRecovery(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const groupedSecret = setup?.secret.match(/.{1,4}/g)?.join(" ") ?? "";

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-none">GÜVENLİK</h2>
      <p className="font-mono text-[12px] mt-2">
        Yönetici hesabı için TOTP (Google Authenticator, Authy, 1Password). SMS yok.
      </p>
      {error && (
        <div className="mt-3">
          <AdminNotice kind="error">{error}</AdminNotice>
        </div>
      )}
      {!status && !error && (
        <div className="mt-3">
          <AdminNotice kind="loading">Yükleniyor…</AdminNotice>
        </div>
      )}
      {status && (
        <div className="mt-4 border-[3px] border-black bg-[#FFFEFA] p-4 shadow-[4px_4px_0_black]">
          <p className="font-mono text-[12px]">
            2FA: {status.enabled ? "AÇIK" : "KAPALI"}
            {status.enabled
              ? ` • kalan kurtarma kodu: ${status.remainingRecoveryCodes}`
              : ""}
          </p>
          {!status.enabled && !setup && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startSetup()}
              className="mt-3 font-anton border-[3px] border-black bg-[#FFEA00] px-3 py-2"
            >
              2FA KUR
            </button>
          )}
        </div>
      )}

      {setup && (
        <form
          onSubmit={(e) => void confirmSetup(e)}
          className="mt-4 border-[3px] border-black bg-[#FFFEFA] p-4 space-y-3"
        >
          <h3 className="font-anton text-[22px]">KURULUM</h3>
          <p className="font-mono text-[12px]">
            Uygulamada manuel anahtar veya provisioning URI kullan. İlk kod doğrulanmadan 2FA açılmaz.
          </p>
          <label className="block">
            <span className="font-mono text-[10px]">SECRET</span>
            <input
              readOnly
              value={groupedSecret}
              className="mt-1 w-full border-[3px] border-black px-2 py-2 font-mono text-[13px]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px]">OTPAuth URI</span>
            <textarea
              readOnly
              value={setup.otpauthUrl}
              className="mt-1 w-full border-[3px] border-black px-2 py-2 font-mono text-[11px] min-h-[72px]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px]">UYGULAMA KODU</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full border-[3px] border-black px-2 py-2 font-mono text-[16px]"
            />
          </label>
          <button
            disabled={busy}
            className="font-anton border-[3px] border-black bg-black text-white px-3 py-2"
          >
            DOĞRULA VE AKTİF ET
          </button>
        </form>
      )}

      {recovery && recovery.length > 0 && (
        <div className="mt-4 border-[3px] border-[#C8102E] bg-[#FFFEFA] p-4">
          <h3 className="font-anton text-[22px]">KURTARMA KODLARI</h3>
          <p className="font-mono text-[12px] mt-1">
            Bir kez gösterilir. Sakla; her kod tek kullanımlıktır.
          </p>
          <ul className="mt-2 font-mono text-[14px] grid grid-cols-1 sm:grid-cols-2 gap-1">
            {recovery.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {status?.enabled && (
        <form
          onSubmit={(e) => void disable(e)}
          className="mt-4 border-[3px] border-black bg-[#FFFEFA] p-4 space-y-3"
        >
          <h3 className="font-anton text-[22px]">2FA KAPAT</h3>
          <p className="font-mono text-[12px]">Parola + TOTP veya kurtarma kodu gerekir.</p>
          <label className="block">
            <span className="font-mono text-[10px]">PAROLA</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border-[3px] border-black px-2 py-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px]">TOTP VEYA KURTARMA KODU</span>
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="mt-1 w-full border-[3px] border-black px-2 py-2 font-mono"
            />
          </label>
          <button
            disabled={busy}
            className="font-anton border-[3px] border-black bg-[#C8102E] text-white px-3 py-2"
          >
            2FA KAPAT
          </button>
        </form>
      )}
    </div>
  );
}
