"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { forumApiError } from "@/lib/forum-ui";
import {
  TEAM_REQUEST_MESSAGE_MAX,
  TEAM_REQUEST_MESSAGE_MIN,
  TEAM_REQUEST_NAME_MAX,
  TEAM_REQUEST_NAME_MIN,
} from "@/lib/policy";
import { PROVINCES } from "@/lib/provinces";

export default function TakimTalepPage() {
  const router = useRouter();
  const { user, banned, message, loading } = useAuth();
  const loginHref = `/giris?next=${encodeURIComponent("/takim-talep")}`;
  const [teamName, setTeamName] = useState("");
  const [city, setCity] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user && !banned) {
      router.replace(loginHref);
    }
  }, [loading, user, banned, router, loginHref]);

  const nameOk = useMemo(() => {
    const t = teamName.replace(/\s+/g, " ").trim();
    return t.length >= TEAM_REQUEST_NAME_MIN && t.length <= TEAM_REQUEST_NAME_MAX;
  }, [teamName]);
  const messageOk = useMemo(() => {
    const t = why.trim();
    return t.length >= TEAM_REQUEST_MESSAGE_MIN && t.length <= TEAM_REQUEST_MESSAGE_MAX;
  }, [why]);

  async function send() {
    if (!nameOk || !city || !messageOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.replace(/\s+/g, " ").trim(),
          city,
          message: why.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(forumApiError(res.status, data.error));
        return;
      }
      setDone(true);
    } catch {
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ForumShell>
        <p className="font-mono text-[13px]">…</p>
      </ForumShell>
    );
  }

  if (banned) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">YAZAMAZSIN</h1>
        <p className="font-mono text-[13px] mt-2">{message || "Hesabın askıya alınmış."}</p>
      </ForumShell>
    );
  }

  if (!user) {
    return (
      <ForumShell>
        <p className="font-mono text-[13px]">Giriş sayfasına yönlendiriliyorsun…</p>
      </ForumShell>
    );
  }

  if (done) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[36px] leading-[0.85]">TALEP ALINDI</h1>
        <p className="font-mono text-[13px] mt-3 max-w-[480px]">
          Talebin alındı. Takımın Tribün'e eklenmesi için değerlendirilecek.
        </p>
        <Link
          href="/takimlar"
          className="mt-5 inline-block font-anton border-[3px] border-black bg-[#FFEA00] px-4 py-2"
        >
          TRİBÜNLERE DÖN
        </Link>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <Link href="/takimlar" className="font-mono text-[11px] underline">
        ← Tüm tribünler
      </Link>
      <h1 className="font-anton text-[36px] sm:text-[46px] leading-[0.85] mt-3">
        YENİ TAKIM
        <br />
        TALEP ET
      </h1>
      <p className="font-mono text-[13px] mt-3 max-w-[520px]">
        Listede yoksa iste. Aynı takımı ikinci kez bekleyen talep olarak gönderemezsin.
      </p>

      <div className="mt-5 bg-[#FFFEFA] border-[4px] border-black shadow-[6px_6px_0_black] p-4 sm:p-5 space-y-3">
        <label className="block">
          <span className="font-mono text-[10px]">TAKIM ADI</span>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value.slice(0, TEAM_REQUEST_NAME_MAX))}
            className="mt-1 w-full border-[3px] border-black px-3 py-2 font-anton text-[18px] outline-none"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[10px]">ŞEHİR</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] bg-white"
          >
            <option value="">Seç</option>
            {PROVINCES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px]">
            NEDEN EKLENMELİ? ({TEAM_REQUEST_MESSAGE_MIN}–{TEAM_REQUEST_MESSAGE_MAX})
          </span>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value.slice(0, TEAM_REQUEST_MESSAGE_MAX))}
            rows={6}
            className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none resize-y min-h-[140px]"
          />
        </label>
        {error && (
          <p className="font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy || !nameOk || !city || !messageOk}
          onClick={() => void send()}
          className="w-full font-anton text-[16px] py-3 border-[3px] border-black bg-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          {busy ? "GÖNDERİLİYOR…" : "TALEP GÖNDER"}
        </button>
      </div>
    </ForumShell>
  );
}
