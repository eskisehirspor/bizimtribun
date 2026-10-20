"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminNotice, AdminPager, adminJson, formatWhen } from "@/components/admin/AdminUi";
import { btnSmAccent } from "@/components/ui";

type Item = {
  id: number;
  actor: string | null;
  actorUserId: number | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  meta: string | null;
  createdAt: string;
};

type Res = { items: Item[]; total: number; limit: number };

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [applied, setApplied] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (applied) params.set("action", applied);
      setData(await adminJson<Res>(`/api/admin/audit?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-none">DENETİM KAYDI</h2>
      <p className="font-mono text-[12px] mt-2">
        Yetkili işlemlerin değiştirilemez kaydı. Kayıtlar silinemez ve düzenlenemez.
      </p>
      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(action.trim());
        }}
      >
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="işlem (ör. ban_user)"
          className="border-[3px] border-black px-2 py-1 font-mono text-[12px] bg-white"
        />
        <button className={btnSmAccent}>
          FİLTRELE
        </button>
      </form>

      {error && <div className="mt-3"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {loading && <div className="mt-3"><AdminNotice kind="loading">Yükleniyor…</AdminNotice></div>}
      {!loading && data && data.items.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Kayıt yok.</AdminNotice></div>
      )}
      {!loading && data && data.items.length > 0 && (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Zaman</th>
                <th className="p-2">Yapan</th>
                <th className="p-2">İşlem</th>
                <th className="p-2">Hedef</th>
                <th className="p-2">Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t-[2px] border-black align-top">
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                  <td className="p-2">{row.actor || (row.actorUserId ? `#${row.actorUserId}` : "sistem")}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2 whitespace-nowrap">
                    {row.targetType ? `${row.targetType} #${row.targetId}` : "—"}
                  </td>
                  <td className="p-2 max-w-[320px] break-words">{row.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <div className="mt-3">
          <AdminPager page={page} total={data.total} limit={data.limit} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
