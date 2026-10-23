"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";
import { PROVINCES } from "@/lib/provinces";
import { btnDanger, btnPrimary, btnSecondary, btnSm, fieldClass, inputClass, labelClass } from "@/components/ui";

type Item = {
  id: number;
  teamName: string;
  city: string;
  requestCount: number;
  firstAt: string;
  lastAt: string;
  status: string;
};

type Detail = {
  id: number;
  teamName: string;
  city: string;
  status: string;
  requestCount: number;
  requests: Array<{
    id: number;
    message: string;
    createdAt: string;
    username: string;
    userId: number;
    reviewReason: string | null;
  }>;
};

type ListRes = { items: Item[]; total: number; limit: number; page: number };

export default function AdminTeamRequestsPage() {
  const { ask, dialog } = useConfirmAction();
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListRes | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approveOpen, setApproveOpen] = useState<Item | Detail | null>(null);
  const [approveReason, setApproveReason] = useState("");
  const [approveBusy, setApproveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      if (status) qs.set("status", status);
      if (q.trim()) qs.set("q", q.trim());
      if (city) qs.set("city", city);
      setData(await adminJson<ListRes>(`/api/admin/team-requests?${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, status, q, city]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function openDetail(id: number) {
    setError(null);
    try {
      const res = await adminJson<{ group: Detail }>(`/api/admin/team-requests/${id}`);
      setDetail(res.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detay yüklenemedi.");
    }
  }

  async function approve(id: number, reason: string) {
    await adminJson(`/api/admin/team-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    setApproveOpen(null);
    setDetail(null);
    await load();
  }

  async function reject(id: number, reason: string) {
    await adminJson(`/api/admin/team-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    setDetail(null);
    await load();
  }

  return (
    <div>
      {dialog}
      {approveOpen && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-[440px] border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[8px_8px_0_black]">
            <h3 className="font-anton text-[24px] leading-[1.05]">ONAYLA</h3>
            <p className="font-mono text-[12px] mt-2">
              {approveOpen.teamName} takımı eklenecek veya mevcut kayıt kullanılacak. Forum
              otomatik açılmaz.
            </p>
            <label className="block mt-3">
              <span className={labelClass}>NOT (OPSİYONEL)</span>
              <textarea
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                className={`${inputClass} min-h-[72px]`}
              />
            </label>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                disabled={approveBusy}
                onClick={() => {
                  setApproveBusy(true);
                  void approve(approveOpen.id, approveReason).finally(() =>
                    setApproveBusy(false),
                  );
                }}
                className={btnPrimary}
              >
                {approveBusy ? "…" : "ONAYLA"}
              </button>
              <button
                type="button"
                disabled={approveBusy}
                onClick={() => setApproveOpen(null)}
                className={btnSecondary}
              >
                VAZGEÇ
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="font-anton text-[32px] leading-[1.05]">TAKIM TALEPLERİ</h2>
      <div className="flex flex-wrap gap-2 mt-3">
        {["pending", "approved", "rejected", ""].map((key) => (
          <button
            key={key || "all"}
            type="button"
            className={`font-anton border-[3px] border-black px-3 py-1 ${
              status === key ? "bg-[#FFEA00]" : "bg-white"
            }`}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            {key === "pending" ? "BEKLEYEN" : key === "approved" ? "ONAY" : key === "rejected" ? "RED" : "TÜMÜ"}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Ara"
        className={`mt-3 max-w-[320px] ${fieldClass}`}
      />
      <select
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          setPage(1);
        }}
        className={`mt-3 sm:ml-2 max-w-[320px] ${fieldClass}`}
      >
        <option value="">Tüm şehirler</option>
        {PROVINCES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

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
                <th className="p-2">Takım</th>
                <th className="p-2">Şehir</th>
                <th className="p-2">Talep</th>
                <th className="p-2">İlk</th>
                <th className="p-2">Son</th>
                <th className="p-2">Durum</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={`${row.id}-${row.status}`} className="border-t-[2px] border-black">
                  <td className="p-2">{row.teamName}</td>
                  <td className="p-2">{row.city}</td>
                  <td className="p-2">{row.requestCount}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.firstAt)}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.lastAt)}</td>
                  <td className="p-2">{REQUEST_STATUS[row.status] ?? row.status}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void openDetail(row.id)}
                    >
                      Detay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <AdminPager
          page={data.page}
          limit={data.limit}
          total={data.total}
          onPage={setPage}
        />
      )}

      {detail && (
        <div className="mt-5 border-[4px] border-black bg-[#FFFEFA] p-4 shadow-[6px_6px_0_black]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-anton text-[24px] leading-[1.05]">{detail.teamName}</h3>
              <p className="font-mono text-[12px] mt-1">
                {detail.city} • {REQUEST_STATUS[detail.status] ?? detail.status} • {detail.requestCount} talep
              </p>
            </div>
            <button
              type="button"
              className={btnSm}
              onClick={() => setDetail(null)}
            >
              KAPAT
            </button>
          </div>
          <ul className="mt-3 space-y-3">
            {detail.requests.map((row) => (
              <li key={row.id} className="border-[2px] border-black p-2">
                <p className="font-mono text-[12px] opacity-70">
                  {row.username} • {formatWhen(row.createdAt)}
                </p>
                <p className="font-mono text-[13px] mt-1 whitespace-pre-wrap">{row.message}</p>
              </li>
            ))}
          </ul>
          {detail.status === "pending" && (
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  setApproveReason("");
                  setApproveOpen(detail);
                }}
              >
                ONAYLA
              </button>
              <button
                type="button"
                className={btnDanger}
                onClick={() =>
                  ask({
                    title: "REDDET",
                    body: `${detail.teamName} talebi reddedilecek.`,
                    confirmLabel: "REDDET",
                    onConfirm: (reason) => reject(detail.id, reason),
                  })
                }
              >
                REDDET
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const REQUEST_STATUS: Record<string, string> = {
  pending: "bekliyor",
  approved: "onaylandı",
  rejected: "reddedildi",
};
