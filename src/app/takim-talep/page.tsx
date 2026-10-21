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
import BackLink from "@/components/BackLink";
import { btnAccent, btnPrimary, fieldClass, hintClass, inputClass, labelClass } from "@/components/ui";

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
    if (busy) return;
    if (!nameOk) {
      setError(`Takım adı ${TEAM_REQUEST_NAME_MIN}–${TEAM_REQUEST_NAME_MAX} karakter olmalı.`);
      return;
    }
    if (!city) {
      setError("Takımın şehrini seç.");
      return;
    }
    if (!messageOk) {
      setError(`Açıklama en az ${TEAM_REQUEST_MESSAGE_MIN} karakter olmalı.`);
      return;
    }
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
        <p className="font-mono text-[14px]">Yükleniyor…</p>
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
          Talebin alındı. Takımın Tribün&apos;e eklenmesi için değerlendirilecek.
        </p>
        <Link href="/takimlar" className={`mt-5 ${btnAccent}`}>
          ← TAKIM TRİBÜNLERİNE DÖN
        </Link>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <BackLink href="/takimlar">Takım tribünleri</BackLink>
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
          <span className={labelClass}>TAKIM ADI</span>
          <input
            value={teamName}
            onChange={(e) => {
              setTeamName(e.target.value.slice(0, TEAM_REQUEST_NAME_MAX));
              setError(null);
            }}
            className={`mt-1 ${fieldClass.replace("font-mono text-base sm:text-[14px]", "font-anton text-[18px]")}`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>ŞEHİR</span>
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setError(null);
            }}
            className={inputClass}
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
          <span className={labelClass}>
            NEDEN EKLENMELİ? ({TEAM_REQUEST_MESSAGE_MIN}–{TEAM_REQUEST_MESSAGE_MAX} karakter)
          </span>
          <textarea
            value={why}
            onChange={(e) => {
              setWhy(e.target.value.slice(0, TEAM_REQUEST_MESSAGE_MAX));
              setError(null);
            }}
            rows={6}
            className={`${inputClass} resize-y min-h-[140px]`}
          />
          <span className={`${hintClass} block mt-1 text-right tabular-nums`}>
            {why.trim().length}/{TEAM_REQUEST_MESSAGE_MAX}
          </span>
        </label>
        {error && (
          <p role="alert" className="font-mono text-[13px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void send()}
          className={`w-full ${btnPrimary}`}
        >
          {busy ? "GÖNDERİLİYOR…" : "TALEP GÖNDER"}
        </button>
      </div>
    </ForumShell>
  );
}
