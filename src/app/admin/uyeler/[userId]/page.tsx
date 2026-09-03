"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AdminNotice,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";

type Detail = {
  id: number;
  username: string;
  displayName: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  city: string | null;
  teamId: string | null;
  teamName: string | null;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  banned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  banExpiresAt: string | null;
  topics: Array<{
    id: number;
    teamId: string;
    title: string;
    createdAt: string;
    locked: boolean;
    deleted: boolean;
  }>;
  posts: Array<{
    id: number;
    topicId: number;
    topicTitle: string;
    content: string;
    createdAt: string;
    deleted: boolean;
  }>;
};

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const { ask, dialog } = useConfirmAction();
  const [user, setUser] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminJson<{ user: Detail }>(`/api/admin/users/${params.userId}`);
      setUser(data.user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, [params.userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!user) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;

  return (
    <div>
      {dialog}
      <Link href="/admin/uyeler" className="font-mono text-[11px] underline">
        ← üyeler
      </Link>
      <h2 className="font-anton text-[32px] leading-none mt-2">{user.username}</h2>
      <p className="font-mono text-[12px] opacity-70">{user.displayName}</p>

      <div className="grid sm:grid-cols-2 gap-2 mt-4 font-mono text-[12px]">
        {[
          ["E-posta", user.email],
          ["Telefon", user.phone || "—"],
          ["Ad", user.firstName || "—"],
          ["Soyad", user.lastName || "—"],
          ["Doğum", user.birthDate || "—"],
          ["Şehir", user.city || "—"],
          ["Takım", user.teamName || user.teamId || "—"],
          ["Rol", user.role],
          ["Status", user.status],
          ["Kayıt", formatWhen(user.createdAt)],
          ["Son giriş", formatWhen(user.lastLoginAt)],
          ["Ban", user.banned ? "evet" : "hayır"],
          ["Ban tarihi", formatWhen(user.bannedAt)],
          ["Ban bitiş", user.banExpiresAt ? formatWhen(user.banExpiresAt) : "kalıcı / yok"],
          ["Ban gerekçe", user.banReason || "—"],
        ].map(([k, v]) => (
          <div key={k} className="border-[2px] border-black bg-[#FFFEFA] p-2">
            <div className="opacity-50 text-[10px]">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {!user.banned && user.role !== "admin" && (
          <button
            type="button"
            className="font-anton border-[3px] border-black bg-[#C8102E] text-white px-3 py-2"
            onClick={() =>
              ask({
                title: "BANLA",
                body: `${user.username} hesabı banlanacak, oturumları kapanacak.`,
                confirmLabel: "BANLA",
                onConfirm: async (reason) => {
                  await adminJson(`/api/admin/users/${user.id}/ban`, {
                    method: "POST",
                    body: JSON.stringify({ reason }),
                  });
                  await load();
                },
              })
            }
          >
            BANLA
          </button>
        )}
        {user.banned && (
          <button
            type="button"
            className="font-anton border-[3px] border-black bg-[#FFEA00] px-3 py-2"
            onClick={() =>
              ask({
                title: "BAN KALDIR",
                body: `${user.username} banı kaldırılacak.`,
                confirmLabel: "KALDIR",
                onConfirm: async (reason) => {
                  await adminJson(`/api/admin/users/${user.id}/unban`, {
                    method: "POST",
                    body: JSON.stringify({ reason }),
                  });
                  await load();
                },
              })
            }
          >
            BAN KALDIR
          </button>
        )}
        <button
          type="button"
          className="font-anton border-[3px] border-black bg-white px-3 py-2"
          onClick={() =>
            ask({
              title: "ROL DEĞİŞTİR",
              body:
                user.role === "admin"
                  ? "Bu hesabı user yapmak istiyorsun. Başka adminin rolü düşürülemez; son admin korunur."
                  : "Bu hesabı admin yapmak istiyorsun.",
              confirmLabel: "DEĞİŞTİR",
              onConfirm: async (reason) => {
                await adminJson(`/api/admin/users/${user.id}/role`, {
                  method: "PUT",
                  body: JSON.stringify({
                    role: user.role === "admin" ? "user" : "admin",
                    reason,
                  }),
                });
                await load();
              },
            })
          }
        >
          {user.role === "admin" ? "USER YAP" : "ADMIN YAP"}
        </button>
      </div>

      <h3 className="font-anton text-[22px] mt-6">FORUM KONULARI</h3>
      {user.topics.length === 0 ? (
        <AdminNotice kind="empty">Konu yok.</AdminNotice>
      ) : (
        <ul className="mt-2 space-y-1 font-mono text-[12px]">
          {user.topics.map((t) => (
            <li key={t.id} className="border-[2px] border-black bg-[#FFFEFA] p-2">
              #{t.id} {t.title} {t.deleted ? "(silindi)" : ""} {t.locked ? "(kilitli)" : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 className="font-anton text-[22px] mt-6">FORUM MESAJLARI</h3>
      {user.posts.length === 0 ? (
        <AdminNotice kind="empty">Mesaj yok.</AdminNotice>
      ) : (
        <ul className="mt-2 space-y-1 font-mono text-[12px]">
          {user.posts.map((p) => (
            <li key={p.id} className="border-[2px] border-black bg-[#FFFEFA] p-2">
              #{p.id} / konu {p.topicId} {p.deleted ? "(silindi)" : ""} — {p.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
