"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { forumApiError, safeNextPath } from "@/lib/forum-ui";
import { MEMBERSHIP_NOTICE_ITEMS } from "@/lib/membership";
import {
  isStrongPassword,
  passwordChecks,
  PASSWORD_RULE_LABELS,
} from "@/lib/password";
import { formatTrMobileInput } from "@/lib/phone";
import { PROVINCES } from "@/lib/provinces";
import { LEAGUE_LABEL, LEAGUE_ORDER, type LeagueId } from "@/lib/teams";

const inputClass =
  "mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none bg-white";

type TeamOption = { id: string; name: string; league: LeagueId };

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/teams", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTeams(Array.isArray(data.teams) ? data.teams : []);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checks = useMemo(() => passwordChecks(password), [password]);
  const passwordOk = isStrongPassword(password);
  const match = password.length > 0 && password === password2;

  const teamsByLeague = useMemo(() => {
    return LEAGUE_ORDER.map((league) => ({
      league,
      teams: teams.filter((t) => t.league === league),
    })).filter((g) => g.teams.length > 0);
  }, [teams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk || !match) {
      setError(
        !match ? "Parolalar eşleşmiyor." : "Parola kuralları henüz tamam değil.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          firstName,
          lastName,
          birthDate,
          phone,
          email,
          city,
          teamId,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(forumApiError(res.status, data.error));
        return;
      }
      await refresh();
      router.push("/uye-dogrula");
    } catch {
      setError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ForumShell>
      <div className="max-w-[560px] mx-auto bg-[#FFFEFA] border-[4px] border-black shadow-[8px_8px_0_black] p-5 sm:p-6">
        <p className="font-mono text-[10px] tracking-[0.2em]">BİZİM TRİBÜN • ÜYELİK</p>
        <h1 className="font-anton text-[40px] leading-[0.85] mt-2">
          ÜYE
          <br />
          <span className="bg-black text-[#FFEA00] px-2 inline-block -rotate-1">OL</span>
        </h1>
        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-5">
          <section>
            <p className="font-anton text-[14px] mb-2">HESAP</p>
            <div className="space-y-3">
              <label className="block">
                <span className="font-mono text-[10px]">NICKNAME / KULLANICI ADI</span>
                <input
                  required
                  minLength={3}
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  autoComplete="username"
                  placeholder="ornek_taraftar"
                />
                <span className="font-mono text-[10px] opacity-60">
                  Tribünde yalnızca bu görünür.
                </span>
              </label>
              <label className="block">
                <span className="font-mono text-[10px]">PAROLA</span>
                <input
                  required
                  type="password"
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </label>
              <ul className="font-mono text-[11px] space-y-1">
                {PASSWORD_RULE_LABELS.map((rule) => (
                  <li
                    key={rule.key}
                    className={checks[rule.key] ? "text-[#1B7A3A]" : "opacity-50"}
                  >
                    {checks[rule.key] ? "✓" : "○"} {rule.label}
                  </li>
                ))}
              </ul>
              <label className="block">
                <span className="font-mono text-[10px]">PAROLA TEKRAR</span>
                <input
                  required
                  type="password"
                  maxLength={128}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
                {password2.length > 0 && (
                  <span
                    className={`font-mono text-[10px] ${match ? "text-[#1B7A3A]" : "text-[#C8102E]"}`}
                  >
                    {match ? "Eşleşiyor" : "Eşleşmiyor"}
                  </span>
                )}
              </label>
            </div>
          </section>

          <section>
            <p className="font-anton text-[14px] mb-2">KİMLİK</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="font-mono text-[10px]">AD</span>
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  autoComplete="given-name"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px]">SOYAD</span>
                <input
                  required
                  minLength={2}
                  maxLength={40}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label className="block mt-3">
              <span className="font-mono text-[10px]">DOĞUM TARİHİ</span>
              <input
                required
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputClass}
                autoComplete="bday"
                max={new Date().toISOString().slice(0, 10)}
                min="1900-01-01"
              />
            </label>
          </section>

          <section>
            <p className="font-anton text-[14px] mb-2">İLETİŞİM</p>
            <label className="block">
              <span className="font-mono text-[10px]">TELEFON</span>
              <div className="mt-1 flex">
                <span className="shrink-0 border-[3px] border-r-0 border-black px-2 py-2 font-mono text-[13px] bg-[#F2EFE6]">
                  +90
                </span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(formatTrMobileInput(e.target.value))}
                  className={`${inputClass} mt-0`}
                  placeholder="5XX XXX XX XX"
                  autoComplete="tel-national"
                />
              </div>
            </label>
            <label className="block mt-3">
              <span className="font-mono text-[10px]">E-POSTA</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </label>
          </section>

          <section>
            <p className="font-anton text-[14px] mb-2">TRİBÜN</p>
            <label className="block">
              <span className="font-mono text-[10px]">İL</span>
              <select
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              >
                <option value="">Seç</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="block mt-3">
              <span className="font-mono text-[10px]">TUTTUĞUN TAKIM (TÜM LİGLER)</span>
              <select
                required
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={inputClass}
              >
                <option value="">Seç</option>
                {teamsByLeague.map((g) => (
                  <optgroup key={g.league} label={LEAGUE_LABEL[g.league]}>
                    {g.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </section>

          <section className="border-[3px] border-dashed border-black p-3 bg-[#F2EFE6]">
            <p className="font-anton text-[13px]">NEDEN BU BİLGİLER?</p>
            <ul className="mt-2 space-y-2 font-mono text-[11px] leading-[1.4]">
              {MEMBERSHIP_NOTICE_ITEMS.map((item) => (
                <li key={item.label}>
                  <span className="font-bold">{item.label}:</span> {item.why}
                </li>
              ))}
            </ul>
            <p className="font-mono text-[11px] mt-2">
              Aydınlatma metni:{" "}
              <Link href="/kvkk" className="underline">
                KVKK
              </Link>
            </p>
          </section>

          {error && (
            <p className="font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
              {error}
            </p>
          )}
          <button
            disabled={busy || !passwordOk || !match}
            className="w-full font-anton text-[18px] py-3 border-[3px] border-black bg-black text-white disabled:bg-zinc-300"
          >
            {busy ? "…" : "ÜYE OL"}
          </button>
        </form>
        <p className="font-mono text-[12px] mt-4">
          Zaten üye misin?{" "}
          <Link className="underline" href={`/giris?next=${encodeURIComponent(next)}`}>
            Giriş yap
          </Link>
        </p>
      </div>
    </ForumShell>
  );
}

export default function UyeOlPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F2EFE6]" />}>
      <Form />
    </Suspense>
  );
}
