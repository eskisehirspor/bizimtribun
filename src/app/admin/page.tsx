"use client";

import { useEffect, useState } from "react";
import { AdminCard, AdminNotice, adminJson, formatWhen } from "@/components/admin/AdminUi";

type Dashboard = {
  totalMembers: number;
  activeMembers: number;
  totalTopics: number;
  totalPosts: number;
  activeBans: number;
  activeForumTeams: number;
  validVotes: number;
  recent: Array<{
    id: number;
    action: string;
    reason: string | null;
    createdAt: string;
    moderatorUsername: string;
    targetUsername: string | null;
    targetTopicId: number | null;
    targetPostId: number | null;
  }>;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminJson<Dashboard>("/api/admin/dashboard")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!data) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;

  return (
    <div>
      <h2 className="font-anton text-[32px] leading-none">DASHBOARD</h2>
      <p className="font-mono text-[11px] mt-1 opacity-60">Canlı veritabanı sayıları</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <AdminCard title="TOPLAM ÜYE" value={data.totalMembers} />
        <AdminCard title="AKTİF ÜYE" value={data.activeMembers} />
        <AdminCard title="FORUM KONUSU" value={data.totalTopics} />
        <AdminCard title="FORUM MESAJI" value={data.totalPosts} />
        <AdminCard title="AKTİF BAN" value={data.activeBans} />
        <AdminCard title="AKTİF FORUM TAKIMI" value={data.activeForumTeams} />
        <AdminCard title="GEÇERLİ OY" value={data.validVotes} />
      </div>
      <h3 className="font-anton text-[22px] mt-6">SON MODERASYON</h3>
      {data.recent.length === 0 ? (
        <AdminNotice kind="empty">Henüz kayıt yok.</AdminNotice>
      ) : (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-2">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Tarih</th>
                <th className="p-2">Mod</th>
                <th className="p-2">İşlem</th>
                <th className="p-2">Hedef</th>
                <th className="p-2">Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row) => (
                <tr key={row.id} className="border-t-[2px] border-black">
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                  <td className="p-2">{row.moderatorUsername}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">
                    {row.targetUsername ||
                      (row.targetTopicId ? `konu #${row.targetTopicId}` : "") ||
                      (row.targetPostId ? `mesaj #${row.targetPostId}` : "—")}
                  </td>
                  <td className="p-2 max-w-[240px] truncate">{row.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
