"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
} from "@/components/admin/AdminUi";
import { ROLE_LABELS } from "@/lib/permissions";
import { btnPrimary, fieldClass, labelClass } from "@/components/ui";

type UserItem = {
  id: number;
  username: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  status: string;
  role: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  deleted?: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  banned: boolean;
};

type UsersRes = {
  page: number;
  limit: number;
  total: number;
  items: UserItem[];
  teams: Array<{ id: string; name: string }>;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [banned, setBanned] = useState("");
  const [team, setTeam] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (banned) params.set("banned", banned);
    if (team) params.set("team", team);
    try {
      setData(await adminJson<UsersRes>(`/api/admin/users?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [q, role, banned, team, page]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-none">ÜYELER</h2>
      <form
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="block">
          <span className={labelClass}>ARA</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="kullanıcı adı / e-posta / ad"
            className={`mt-1 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>ROL</span>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Hepsi</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>DURUM</span>
          <select
            value={banned}
            onChange={(e) => {
              setBanned(e.target.value);
              setPage(1);
            }}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Hepsi</option>
            <option value="0">Aktif</option>
            <option value="1">Banlı</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>TAKIM</span>
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setPage(1);
            }}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Hepsi</option>
            {(data?.teams || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnPrimary}>
          ARA
        </button>
      </form>

      {error && <div className="mt-3"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {loading && <div className="mt-3"><AdminNotice kind="loading">Yükleniyor…</AdminNotice></div>}
      {!loading && data && data.items.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Bu filtreyle üye yok.</AdminNotice></div>
      )}
      {!loading && data && data.items.length > 0 && (
        <>
          <ul className="md:hidden mt-3 space-y-2">
            {data.items.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/uyeler/${u.id}`}
                  className="flex items-center gap-3 border-[3px] border-black bg-[#FFFEFA] p-3 font-mono text-[13px] hover:bg-[#FFEA00]/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold truncate">@{u.username}</span>
                    <span className="block text-[12px] opacity-75">
                      {statusLabel(u)} • {ROLE_LABELS[u.role] ?? u.role} • {u.teamName || "takım yok"}
                    </span>
                    <span className="block text-[12px] opacity-75">Kayıt: {formatWhen(u.createdAt)}</span>
                  </span>
                  <span aria-hidden="true" className="font-anton text-[20px]">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
            <table className="w-full text-left font-mono text-[13px]">
              <thead className="bg-black text-[#FFEA00]">
                <tr>
                  <th className="p-2">Kullanıcı adı</th>
                  <th className="p-2">Görünen ad</th>
                  <th className="p-2">Takım</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">Rol</th>
                  <th className="p-2">Kayıt</th>
                  <th className="p-2">Son giriş</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-t-[2px] border-black">
                    <td className="p-2">
                      <Link href={`/admin/uyeler/${u.id}`} className="underline underline-offset-4 font-bold">
                        {u.username}
                      </Link>
                    </td>
                    <td className="p-2">{u.displayName}</td>
                    <td className="p-2">{u.teamName || "—"}</td>
                    <td className="p-2">{statusLabel(u)}</td>
                    <td className="p-2">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="p-2 whitespace-nowrap">{formatWhen(u.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">{formatWhen(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {data && (
        <AdminPager page={page} limit={data.limit} total={data.total} onPage={setPage} />
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "aktif",
  banned: "banlı",
  suspended: "askıda",
  pending: "onay bekliyor",
  deleted: "silindi",
};

function statusLabel(u: UserItem) {
  if (u.deleted) return "silindi";
  const base = u.banned ? "banlı" : (STATUS_LABEL[u.status] ?? u.status);
  const proof = u.phoneVerified ? " • telefon doğrulu" : u.emailVerified ? " • e-posta doğrulu" : "";
  return `${base}${proof}`;
}
