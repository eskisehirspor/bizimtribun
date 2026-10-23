"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNotice, adminJson, formatWhen, useConfirmAction } from "@/components/admin/AdminUi";
import { checkboxClass, checkLabelClass } from "@/components/ui";
import { PROVINCES } from "@/lib/provinces";
import { foldTr } from "@/lib/teams";

type Team = {
  id: string;
  name: string;
  league: string;
  city: string;
  bleed: string;
  accent: string;
  isActive: boolean;
  isForumActive: boolean;
  votes: number;
};
type League = { id: string; name: string; sortOrder: number };
type Season = {
  id: number;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  teamCount: number;
};
type Res = { teams: Team[]; leagues: League[]; seasons: Season[]; currentSeason: string | null };

const input = "min-h-11 border-[3px] border-black px-2 py-1 font-mono text-base sm:text-[13px] bg-white";
const button =
  "inline-flex min-h-10 items-center justify-center font-anton text-[13px] border-[3px] border-black px-3 disabled:opacity-50 disabled:cursor-not-allowed";

export default function AdminTeamsPage() {
  const { ask, dialog } = useConfirmAction();
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"teams" | "leagues" | "seasons">("teams");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Team | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminJson<Res>("/api/admin/teams"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const leagueName = useMemo(
    () => new Map((data?.leagues ?? []).map((l) => [l.id, l.name])),
    [data],
  );
  const shown = useMemo(() => {
    const q = foldTr(query.trim());
    return (data?.teams ?? []).filter((t) => !q || foldTr(t.name).includes(q) || t.id.includes(q));
  }, [data, query]);

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!data) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-[1.05]">TAKIMLAR, LİGLER, SEZONLAR</h2>
      <p className="font-mono text-[12px] mt-2">
        Aktif sezon: <b>{data.currentSeason ?? "tanımlı değil"}</b>. Takım adını, ligini veya rengini
        değiştirmek oyları etkilemez. Pasif takım yeni oy almaz, eski oyları sayılmaya devam eder.
        Her değişiklik denetim kaydına yazılır.
      </p>
      <div className="flex gap-2 mt-3">
        {(
          [
            ["teams", "TAKIMLAR"],
            ["leagues", "LİGLER"],
            ["seasons", "SEZONLAR"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`${button} ${tab === id ? "bg-[#FFEA00]" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "teams" && (
        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="takım ara"
            className={input}
          />
          {editing && (
            <TeamEditor
              team={editing}
              leagues={data.leagues}
              onCancel={() => setEditing(null)}
              onSave={(patch) =>
                ask({
                  title: "TAKIMI GÜNCELLE",
                  body: `${editing.name} için değişiklikler kaydedilecek.`,
                  confirmLabel: "KAYDET",
                  onConfirm: async (reason) => {
                    await adminJson(`/api/admin/teams/${editing.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ ...patch, reason }),
                    });
                    setEditing(null);
                    await load();
                  },
                })
              }
            />
          )}
          <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
            <table className="w-full text-left font-mono text-[12px]">
              <thead className="bg-black text-[#FFEA00]">
                <tr>
                  <th className="p-2">Takım</th>
                  <th className="p-2">Lig</th>
                  <th className="p-2">İl</th>
                  <th className="p-2">Oy</th>
                  <th className="p-2">Oy alır</th>
                  <th className="p-2">Forum</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="border-t-[2px] border-black">
                    <td className="p-2">
                      <span
                        className="inline-block w-3 h-3 border border-black mr-1 align-middle"
                        style={{ background: `linear-gradient(90deg, ${t.bleed} 50%, ${t.accent} 50%)` }}
                      />
                      {t.name}
                    </td>
                    <td className="p-2">{leagueName.get(t.league) ?? t.league}</td>
                    <td className="p-2">{t.city || "—"}</td>
                    <td className="p-2 tabular-nums">{t.votes.toLocaleString("tr-TR")}</td>
                    <td className="p-2">{t.isActive ? "evet" : "PASİF"}</td>
                    <td className="p-2">{t.isForumActive ? "açık" : "—"}</td>
                    <td className="p-2">
                      <button type="button" className="underline" onClick={() => setEditing(t)}>
                        düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "leagues" && (
        <div className="mt-3 space-y-2">
          {data.leagues.map((l) => (
            <LeagueRow
              key={l.id}
              league={l}
              onSave={(patch) =>
                ask({
                  title: "LİGİ GÜNCELLE",
                  body: `${l.name} ligi güncellenecek.`,
                  confirmLabel: "KAYDET",
                  onConfirm: async (reason) => {
                    await adminJson(`/api/admin/leagues/${l.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ ...patch, reason }),
                    });
                    await load();
                  },
                })
              }
            />
          ))}
        </div>
      )}

      {tab === "seasons" && (
        <div className="mt-3">
          <SeasonForm
            onCreate={async (body) => {
              await adminJson("/api/admin/seasons", { method: "POST", body: JSON.stringify(body) });
              await load();
            }}
          />
          {data.seasons.length === 0 ? (
            <div className="mt-3">
              <AdminNotice kind="empty">Henüz sezon yok.</AdminNotice>
            </div>
          ) : (
            <ul className="mt-3 space-y-2 font-mono text-[12px]">
              {data.seasons.map((s) => (
                <li key={s.id} className="border-[3px] border-black bg-[#FFFEFA] p-2 flex flex-wrap gap-2 items-center">
                  <b className="font-anton text-[16px]">{s.label}</b>
                  <span>
                    {formatWhen(s.startsOn)} → {formatWhen(s.endsOn)} • {s.teamCount} takım kaydı
                  </span>
                  {s.isCurrent ? (
                    <span className="bg-[#FFEA00] border-[2px] border-black px-1">AKTİF</span>
                  ) : (
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        ask({
                          title: "AKTİF SEZON",
                          body: `${s.label} aktif sezon olacak.`,
                          confirmLabel: "AKTİF YAP",
                          onConfirm: async (reason) => {
                            await adminJson(`/api/admin/seasons/${s.id}/current`, {
                              method: "POST",
                              body: JSON.stringify({ reason }),
                            });
                            await load();
                          },
                        })
                      }
                    >
                      aktif yap
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TeamEditor({
  team,
  leagues,
  onCancel,
  onSave,
}: {
  team: Team;
  leagues: League[];
  onCancel: () => void;
  onSave: (patch: Record<string, string | boolean>) => void;
}) {
  const [name, setName] = useState(team.name);
  const [league, setLeague] = useState(team.league);
  const [city, setCity] = useState(team.city);
  const [primary, setPrimary] = useState(team.bleed);
  const [secondary, setSecondary] = useState(team.accent);
  const [active, setActive] = useState(team.isActive);
  const [forum, setForum] = useState(team.isForumActive);

  function patch() {
    const out: Record<string, string | boolean> = {};
    if (name !== team.name) out.name = name;
    if (league !== team.league) out.league = league;
    if (city !== team.city && city) out.city = city;
    if (primary.toUpperCase() !== team.bleed.toUpperCase()) out.colorPrimary = primary;
    if (secondary.toUpperCase() !== team.accent.toUpperCase()) out.colorSecondary = secondary;
    if (active !== team.isActive) out.isActive = active;
    if (forum !== team.isForumActive) out.isForumActive = forum;
    return out;
  }

  return (
    <div className="mt-3 border-[3px] border-black bg-white p-3 grid sm:grid-cols-2 gap-2 font-mono text-[12px]">
      <label>
        Ad
        <input className={`${input} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Lig
        <select className={`${input} w-full`} value={league} onChange={(e) => setLeague(e.target.value)}>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        İl
        <select className={`${input} w-full`} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">—</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 items-end">
        <label>
          Renk 1
          <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="block" />
        </label>
        <label>
          Renk 2
          <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="block" />
        </label>
      </div>
      <label className={checkLabelClass}>
        <input type="checkbox" className={checkboxClass} checked={active} onChange={(e) => setActive(e.target.checked)} />
        Yeni oy alabilir
      </label>
      <label className={checkLabelClass}>
        <input type="checkbox" className={checkboxClass} checked={forum} onChange={(e) => setForum(e.target.checked)} />
        Takım tribünü açık
      </label>
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="button"
          className={`${button} bg-[#FFEA00]`}
          disabled={Object.keys(patch()).length === 0}
          onClick={() => onSave(patch())}
        >
          KAYDET
        </button>
        <button type="button" className={`${button} bg-white`} onClick={onCancel}>
          VAZGEÇ
        </button>
      </div>
    </div>
  );
}

function LeagueRow({
  league,
  onSave,
}: {
  league: League;
  onSave: (patch: { name?: string; sortOrder?: number }) => void;
}) {
  const [name, setName] = useState(league.name);
  const [order, setOrder] = useState(String(league.sortOrder));
  const changed = name !== league.name || Number(order) !== league.sortOrder;
  return (
    <div className="flex flex-wrap gap-2 items-center border-[3px] border-black bg-[#FFFEFA] p-2 font-mono text-[12px]">
      <span className="w-[60px] opacity-60">{league.id}</span>
      <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      <label>
        sıra{" "}
        <input
          className={`${input} w-[60px]`}
          inputMode="numeric"
          value={order}
          onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <button
        type="button"
        disabled={!changed}
        className={`${button} bg-[#FFEA00] disabled:opacity-40`}
        onClick={() => onSave({ name, sortOrder: Number(order) })}
      >
        KAYDET
      </button>
    </div>
  );
}

function SeasonForm({
  onCreate,
}: {
  onCreate: (body: { label: string; startsOn: string; endsOn: string; makeCurrent: boolean }) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap gap-2 items-end border-[3px] border-black bg-white p-3 font-mono text-[12px]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onCreate({ label, startsOn, endsOn, makeCurrent });
          setLabel("");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kaydedilemedi.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Sezon
        <input className={`${input} block`} placeholder="2026-27" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label>
        Başlangıç
        <input type="date" className={`${input} block`} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </label>
      <label>
        Bitiş
        <input type="date" className={`${input} block`} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </label>
      <label className={checkLabelClass}>
        <input type="checkbox" className={checkboxClass} checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
        Aktif sezon yap
      </label>
      <button disabled={busy} className={`${button} bg-[#FFEA00]`}>
        SEZON AÇ
      </button>
      <p className="w-full opacity-70">
        Sezon açılınca aktif takımların o anki ligleri sezon geçmişine kaydedilir.
      </p>
      {error && <p className="w-full text-[#C8102E]">{error}</p>}
    </form>
  );
}
