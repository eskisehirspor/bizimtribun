"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { LEAGUE_LABEL, LEAGUE_ORDER, foldTr, type LeagueId } from "@/lib/teams";
import { inputClass, Notice, primaryButton, secondaryButton } from "./ui";
import { checkboxClass, chipClass, hintClass, labelClass } from "@/components/ui";

export type PickerTeam = { id: string; name: string; league: LeagueId };

type Props = {
  initialTeamId?: string | null;
  initialCity?: string | null;
  busy: boolean;
  error: string | null;
  confirmLabel: string;
  onConfirm: (teamId: string, city: string | null) => void;
};

/**
 * Pick → review → confirm. Until the last button the choice can be changed
 * freely; the confirmation screen states plainly that it is permanent.
 */
export default function TeamPicker({
  initialTeamId,
  initialCity,
  busy,
  error,
  confirmLabel,
  onConfirm,
}: Props) {
  const [teams, setTeams] = useState<PickerTeam[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>(LEAGUE_LABEL);
  const [loadError, setLoadError] = useState(false);
  const [teamId, setTeamId] = useState(initialTeamId ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<"all" | LeagueId>("all");
  const [reviewing, setReviewing] = useState(false);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/teams", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setTeams(Array.isArray(d.teams) ? d.teams : []);
        if (Array.isArray(d.leagues)) {
          setLabels({
            ...LEAGUE_LABEL,
            ...Object.fromEntries(
              (d.leagues as { id: string; name: string }[]).map((l) => [l.id, l.name]),
            ),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = foldTr(query.trim());
    return (teams ?? []).filter(
      (t) => (league === "all" || t.league === league) && (!q || foldTr(t.name).includes(q)),
    );
  }, [teams, query, league]);
  const chosen = teams?.find((t) => t.id === teamId);

  if (loadError) return <Notice tone="error">Takım listesi yüklenemedi. Sayfayı yenile.</Notice>;
  if (!teams) return <p className="font-mono text-[12px]">Takımlar yükleniyor…</p>;

  if (reviewing && chosen) {
    return (
      <div className="space-y-4">
        <div className="border-[4px] border-black bg-[#FFEA00] p-4 shadow-[4px_4px_0_black]">
          <p className={labelClass}>SEÇİMİN</p>
          <p className="font-anton text-[30px] leading-[1.05] mt-1">{chosen.name}</p>
          <p className="font-mono text-[13px] mt-1">
            {labels[chosen.league]}
            {city ? ` • ${city}` : ""}
          </p>
        </div>
        <div className="border-[3px] border-black bg-white p-3 font-mono text-[13px] leading-[1.45]">
          <p className="font-anton text-[18px]">BU SEÇİM KALICIDIR</p>
          <p className="mt-1">
            Onayladığında oyun {chosen.name} için sayılır ve hesabın bu takıma kilitlenir. Daha
            sonra takım değiştiremez, oyunu silip yeniden veremez veya başka takıma
            taşıyamazsın.
          </p>
          {city && (
            <p className="mt-1">İl bilgin ({city}) il sıralamasında kullanılır, sonradan değiştirilemez.</p>
          )}
        </div>
        <label className="flex min-h-11 items-center gap-3 font-mono text-[13px] border-[3px] border-black bg-[#FFFEFA] p-3">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className={checkboxClass}
          />
          <span>Takım seçimimin kalıcı olduğunu ve değiştirilemeyeceğini anladım.</span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        {!ack && (
          <p className={hintClass}>Onaylamak için yukarıdaki kutuyu işaretle.</p>
        )}
        <button
          type="button"
          disabled={busy || !ack}
          onClick={() => onConfirm(chosen.id, city || null)}
          className={primaryButton}
        >
          {busy ? "KAYDEDİLİYOR…" : confirmLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setReviewing(false);
            setAck(false);
          }}
          className={secondaryButton}
        >
          GERİ DÖN, SEÇİMİ DEĞİŞTİR
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lig filtresi">
        {(["all", ...LEAGUE_ORDER] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={league === id}
            onClick={() => setLeague(id)}
            className={chipClass(league === id)}
          >
            {id === "all" ? "TÜMÜ" : labels[id].toLocaleUpperCase("tr")}
          </button>
        ))}
      </div>
      <label className="block">
        <span className={labelClass}>TAKIM ARA</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Takım adı…"
          type="search"
          className={inputClass}
        />
      </label>
      <div
        role="radiogroup"
        aria-label="Takımlar"
        className="max-h-[50vh] md:max-h-[320px] overflow-auto overscroll-contain border-[3px] border-black divide-y-[2px] divide-black bg-white"
      >
        {shown.map((t) => (
          <label
            key={t.id}
            className={`flex min-h-11 items-center gap-3 px-3 py-2 cursor-pointer ${
              t.id === teamId ? "bg-[#FFEA00]" : ""
            }`}
          >
            <input
              type="radio"
              name="team"
              value={t.id}
              checked={t.id === teamId}
              onChange={() => setTeamId(t.id)}
              className={checkboxClass}
            />
            <span className="font-anton text-[15px] flex-1">{t.name}</span>
            <span className="font-mono text-[12px] opacity-70">{labels[t.league]}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="p-3 font-mono text-[13px]">Eşleşen takım yok.</p>}
      </div>
      <label className="block">
        <span className={labelClass}>YAŞADIĞIN İL (ZORUNLU)</span>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} required>
          <option value="" disabled>
            İlini seç
          </option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className={`block mt-1 ${hintClass}`}>
          İlini konumundan tahmin etmeyiz; seçtiğin ilin haritasında sayılırsın.
        </span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      {!chosen && <p className={hintClass}>Devam etmek için listeden takımını seç.</p>}
      {chosen && !city && <p className={hintClass}>Devam etmek için yaşadığın ili seç.</p>}
      <button
        type="button"
        disabled={!chosen || !city}
        onClick={() => setReviewing(true)}
        className={primaryButton}
      >
        {chosen ? `DEVAM ET: ${chosen.name.toLocaleUpperCase("tr")}` : "DEVAM ET"}
      </button>
    </div>
  );
}
