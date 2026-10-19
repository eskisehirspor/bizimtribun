"use client";

import { useEffect, useMemo, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { LEAGUE_LABEL, LEAGUE_ORDER, foldTr, type LeagueId } from "@/lib/teams";
import { inputClass, Notice, primaryButton, secondaryButton } from "./ui";

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
        if (!cancelled) setTeams(Array.isArray(d.teams) ? d.teams : []);
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
          <p className="font-mono text-[10px]">SEÇİMİN</p>
          <p className="font-anton text-[30px] leading-none mt-1">{chosen.name}</p>
          <p className="font-mono text-[11px] mt-1">
            {LEAGUE_LABEL[chosen.league]}
            {city ? ` • ${city}` : " • il belirtilmedi"}
          </p>
        </div>
        <div className="border-[3px] border-black bg-white p-3 font-mono text-[12px] leading-[1.45]">
          <p className="font-anton text-[18px]">BU SEÇİM KALICIDIR</p>
          <p className="mt-1">
            Onayladığında oyun {chosen.name} için sayılır ve hesabın bu takıma kilitlenir. Daha
            sonra takım değiştiremez, oyunu silip yeniden veremez veya başka takıma
            taşıyamazsın.
          </p>
          {city ? (
            <p className="mt-1">İl bilgin ({city}) il sıralamasında kullanılır, sonradan değiştirilemez.</p>
          ) : (
            <p className="mt-1">İl seçmediğin için oyun yalnızca Türkiye genelinde sayılır.</p>
          )}
        </div>
        <label className="flex items-start gap-2 font-mono text-[12px]">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 w-4 h-4"
          />
          <span>Takım seçimimin kalıcı olduğunu ve değiştirilemeyeceğini anladım.</span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
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
            className={`font-anton text-[12px] px-2 py-1 border-[2px] border-black ${
              league === id ? "bg-black text-[#FFEA00]" : "bg-white"
            }`}
          >
            {id === "all" ? "TÜMÜ" : LEAGUE_LABEL[id].toLocaleUpperCase("tr")}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="font-mono text-[10px]">TAKIM ARA</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Takım adı…"
          className={inputClass}
        />
      </label>
      <div
        role="radiogroup"
        aria-label="Takımlar"
        className="max-h-[280px] overflow-auto border-[3px] border-black divide-y-[2px] divide-black bg-white"
      >
        {shown.map((t) => (
          <label
            key={t.id}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
              t.id === teamId ? "bg-[#FFEA00]" : ""
            }`}
          >
            <input
              type="radio"
              name="team"
              value={t.id}
              checked={t.id === teamId}
              onChange={() => setTeamId(t.id)}
            />
            <span className="font-anton text-[15px] flex-1">{t.name}</span>
            <span className="font-mono text-[10px] opacity-70">{LEAGUE_LABEL[t.league]}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="p-3 font-mono text-[12px]">Eşleşen takım yok.</p>}
      </div>
      <label className="block">
        <span className="font-mono text-[10px]">YAŞADIĞIN İL (İSTEĞE BAĞLI)</span>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
          <option value="">Belirtmek istemiyorum</option>
          {PROVINCES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="font-mono text-[10px] opacity-70">
          İlini konumundan tahmin etmeyiz; sen seçersen il haritasında sayılırsın.
        </span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <button
        type="button"
        disabled={!chosen}
        onClick={() => setReviewing(true)}
        className={primaryButton}
      >
        DEVAM ET
      </button>
    </div>
  );
}
