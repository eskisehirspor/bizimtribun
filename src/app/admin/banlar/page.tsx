"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";

type Item = {
  userId: number | null;
  username: string | null;
  reason: string | null;
  bannedAt: string | null;
  expiresAt: string | null;
  permanent: boolean;
  lifted: boolean;
  bannedBy: string | null;
  action?: string;
};

type Res = { items: Item[]; total: number; limit: number; state: string };

export default function AdminBansPage() {
  const { ask, dialog } = useConfirmAction();
  const [state, setState] = useState<"active" | "all">("active");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await adminJson<Res>(`/api/admin/bans?state=${state}&page=${page}&limit=25`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [state, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">BANLAR</h2>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          className={`font-anton border-[3px] border-black px-3 py-1 ${state === "active" ? "bg-[#FFEA00]" : "bg-white"}`}
          onClick={() => {
            setState("active");
            setPage(1);
          }}
        >
          AKTİF
        </button>
        <button
          type="button"
          className={`font-anton border-[3px] border-black px-3 py-1 ${state === "all" ? "bg-[#FFEA00]" : "bg-white"}`}
          onClick={() => {
            setState("all");
            setPage(1);
          }}
        >
          GEÇMİŞ
        </button>
      </div>

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
                <th className="p-2">Username</th>
                <th className="p-2">Gerekçe</th>
                <th className="p-2">Başlangıç</th>
                <th className="p-2">Bitiş</th>
                <th className="p-2">Süre</th>
                <th className="p-2">Admin</th>
                <th className="p-2">Kaldırıldı</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row, i) => (
                <tr key={`${row.userId}-${row.bannedAt}-${i}`} className="border-t-[2px] border-black">
                  <td className="p-2">
                    {row.userId ? (
                      <Link className="underline" href={`/admin/uyeler/${row.userId}`}>
                        {row.username || row.userId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 max-w-[220px] truncate">{row.reason || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.bannedAt)}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.expiresAt)}</td>
                  <td className="p-2">{row.permanent ? "kalıcı" : "süreli"}</td>
                  <td className="p-2">{row.bannedBy || "—"}</td>
                  <td className="p-2">{row.lifted ? "evet" : "hayır"}</td>
                  <td className="p-2">
                    {row.userId && !row.lifted && (
                      <button
                        type="button"
                        className="border-[2px] border-black px-2 bg-[#FFEA00]"
                        onClick={() =>
                          ask({
                            title: "BAN KALDIR",
                            body: row.username || String(row.userId),
                            confirmLabel: "KALDIR",
                            onConfirm: async (reason) => {
                              await adminJson(`/api/admin/bans/${row.userId}/unban`, {
                                method: "POST",
                                body: JSON.stringify({ reason }),
                              });
                              await load();
                            },
                          })
                        }
                      >
                        kaldır
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <AdminPager page={page} limit={data.limit} total={data.total} onPage={setPage} />}
    </div>
  );
}
