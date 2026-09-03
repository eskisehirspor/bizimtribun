"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  AdminPager,
  adminJson,
  formatWhen,
} from "@/components/admin/AdminUi";

type UserItem = {
  id: number;
  username: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  status: string;
  role: string;
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
    void load();
  }, [load]);

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-none">ÜYELER</h2>
      <form
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="username / e-posta / ad"
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        >
          <option value="">Rol: hepsi</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <select
          value={banned}
          onChange={(e) => {
            setBanned(e.target.value);
            setPage(1);
          }}
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        >
          <option value="">Durum: hepsi</option>
          <option value="0">aktif</option>
          <option value="1">banlı</option>
        </select>
        <select
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setPage(1);
          }}
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        >
          <option value="">Takım: hepsi</option>
          {(data?.teams || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit" className="font-anton border-[3px] border-black bg-[#FFEA00] px-3">
          ARA
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
                <th className="p-2">Username</th>
                <th className="p-2">Görünen</th>
                <th className="p-2">Takım</th>
                <th className="p-2">Status</th>
                <th className="p-2">Rol</th>
                <th className="p-2">Kayıt</th>
                <th className="p-2">Son giriş</th>
                <th className="p-2">Ban</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t-[2px] border-black">
                  <td className="p-2">
                    <Link href={`/admin/uyeler/${u.id}`} className="underline font-bold">
                      {u.username}
                    </Link>
                  </td>
                  <td className="p-2">{u.displayName}</td>
                  <td className="p-2">{u.teamName || "—"}</td>
                  <td className="p-2">{u.status}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(u.createdAt)}</td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(u.lastLoginAt)}</td>
                  <td className="p-2">{u.banned ? "banlı" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <AdminPager page={page} limit={data.limit} total={data.total} onPage={setPage} />
      )}
    </div>
  );
}
