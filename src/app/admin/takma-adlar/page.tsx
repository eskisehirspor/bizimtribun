"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";
import { btnPrimary, btnSm, fieldClass, labelClass } from "@/components/ui";

type Item = {
  name: string;
  kind: string;
  teamId: string | null;
  teamName: string | null;
  note: string | null;
  createdAt: string;
  releasedAt: string | null;
};

type ListRes = { items: Item[]; total: number; limit: number; page: number };

const KIND: Record<string, string> = {
  team: "takım",
  city: "il",
  generic: "site / genel",
  manual: "elle eklendi",
};

export default function AdminReservedUsernamesPage() {
  const { ask, dialog } = useConfirmAction();
  const [state, setState] = useState<"reserved" | "released">("reserved");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "50", state });
      if (q.trim()) qs.set("q", q.trim());
      setData(await adminJson<ListRes>(`/api/admin/reserved-usernames?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, state, q]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function release(name: string, reason: string) {
    await adminJson(`/api/admin/reserved-usernames/${encodeURIComponent(name)}/release`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || undefined }),
    });
    setInfo(`@${name} serbest bırakıldı. Artık herkes bu adla üye olabilir.`);
    await load();
  }

  async function reserve(name: string, note: string) {
    const res = await adminJson<{ name: string }>(`/api/admin/reserved-usernames`, {
      method: "POST",
      body: JSON.stringify({ name, note: note || undefined }),
    });
    setInfo(`@${res.name} ayrıldı. Bu adla yeni üyelik açılamaz.`);
    await load();
  }

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">AYRILMIŞ TAKMA ADLAR</h2>
      <p className="font-mono text-[12px] mt-2 max-w-[640px]">
        Bu adlarla yeni üyelik açılamaz. Alt çizgi sayılmaz: <b>eskisehir_spor</b> da{" "}
        <b>eskisehirspor</b> gibi engellenir. Bir adı satmak ya da vermek için serbest bırak; o adla ilk
        üye olan alır.
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-2 border-[3px] border-black bg-[#FFFEFA] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAdding(true);
          setError(null);
          setInfo(null);
          void reserve(newName, newNote)
            .then(() => {
              setNewName("");
              setNewNote("");
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Eklenemedi."))
            .finally(() => setAdding(false));
        }}
      >
        <label className="block">
          <span className={labelClass}>YENİ AD AYIR</span>
          <input
            id="reserve-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ör. kirmizisimsek"
            maxLength={30}
            className={`max-w-[220px] ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>NOT (İSTEĞE BAĞLI)</span>
          <input
            id="reserve-note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            maxLength={200}
            className={`max-w-[280px] ${fieldClass}`}
          />
        </label>
        <button type="submit" disabled={adding || newName.trim().length < 3} className={btnPrimary}>
          {adding ? "…" : "AYIR"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-4">
        {(["reserved", "released"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`font-anton border-[3px] border-black px-3 py-1 ${
              state === key ? "bg-[#FFEA00]" : "bg-white"
            }`}
            onClick={() => {
              setState(key);
              setPage(1);
            }}
          >
            {key === "reserved" ? "AYRILMIŞ" : "SERBEST BIRAKILAN"}
          </button>
        ))}
      </div>
      <input
        id="reserved-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Ad veya takım ara"
        className={`mt-3 max-w-[320px] ${fieldClass}`}
      />

      {info && (
        <div className="mt-3">
          <AdminNotice kind="empty">{info}</AdminNotice>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <AdminNotice kind="error">{error}</AdminNotice>
        </div>
      )}
      {loading && (
        <div className="mt-3">
          <AdminNotice kind="loading">Yükleniyor…</AdminNotice>
        </div>
      )}
      {!loading && data && data.items.length === 0 && (
        <div className="mt-3">
          <AdminNotice kind="empty">Kayıt yok.</AdminNotice>
        </div>
      )}
      {!loading && data && data.items.length > 0 && (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Ad</th>
                <th className="p-2">Tür</th>
                <th className="p-2">Takım / not</th>
                <th className="p-2">{state === "released" ? "Serbest bırakıldı" : "Eklendi"}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.name} className="border-t-[2px] border-black">
                  <td className="p-2 font-bold">@{row.name}</td>
                  <td className="p-2">{KIND[row.kind] ?? row.kind}</td>
                  <td className="p-2">{row.teamName ?? row.note ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">
                    {formatWhen(state === "released" ? row.releasedAt : row.createdAt)}
                  </td>
                  <td className="p-2">
                    {state === "reserved" ? (
                      <button
                        type="button"
                        className={btnSm}
                        onClick={() =>
                          ask({
                            title: "SERBEST BIRAK",
                            body: `@${row.name} serbest kalacak; bu adla ilk üye olan alır.`,
                            confirmLabel: "SERBEST BIRAK",
                            tone: "primary",
                            requireReason: false,
                            onConfirm: (reason) => release(row.name, reason),
                          })
                        }
                      >
                        SERBEST BIRAK
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={btnSm}
                        onClick={() => {
                          setError(null);
                          void reserve(row.name, row.note ?? "").catch((err) =>
                            setError(err instanceof Error ? err.message : "Ayrılamadı."),
                          );
                        }}
                      >
                        TEKRAR AYIR
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <AdminPager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
      )}
    </div>
  );
}
