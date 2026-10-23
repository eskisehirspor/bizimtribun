"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdminCan, useAdminViewer } from "@/components/admin/AdminShell";
import { canBanRole, ROLE_LABELS } from "@/lib/permissions";
import {
  AdminNotice,
  adminJson,
  formatWhen,
  useConfirmAction,
} from "@/components/admin/AdminUi";
import { btnAccent, btnDanger, btnSecondary } from "@/components/ui";

type Detail = {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  phoneMasked: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  deleted: boolean;
  vote: {
    teamId: string;
    teamName: string | null;
    city: string;
    castAt: string;
    status: string;
    voidedAt: string | null;
    voidReason: string | null;
  } | null;
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
  const can = useAdminCan();
  const viewer = useAdminViewer();
  const [nextRole, setNextRole] = useState("user");
  const [user, setUser] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminJson<{ user: Detail }>(`/api/admin/users/${params.userId}`);
      setUser(data.user);
      setNextRole(data.user.role);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, [params.userId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const revealPhone = async () => {
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const data = await adminJson<{ phone: string }>(`/api/admin/users/${params.userId}/phone`, {
        method: "POST",
      });
      setPhone(data.phone);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Gösterilemedi.");
    } finally {
      setPhoneBusy(false);
    }
  };

  if (error) return <AdminNotice kind="error">{error}</AdminNotice>;
  if (!user) return <AdminNotice kind="loading">Yükleniyor…</AdminNotice>;

  return (
    <div>
      {dialog}
      <Link href="/admin/uyeler" className="font-mono text-[12px] underline">
        ← üyeler
      </Link>
      <h2 className="font-anton text-[32px] leading-[1.05] mt-2">{user.username}</h2>
      <p className="font-mono text-[12px] opacity-70">{user.displayName}</p>

      <div className="grid sm:grid-cols-2 gap-2 mt-4 font-mono text-[12px]">
        {[
          ["E-posta", `${user.email || "—"}${user.email ? (user.emailVerified ? " (doğrulandı)" : " (doğrulanmadı)") : ""}`],
          [
            "Telefon",
            <>
              {phone || user.phoneMasked || "—"}
              {user.phoneVerified ? " (doğrulandı)" : " (doğrulanmadı)"}
              {can("users.phone") && user.phoneMasked && !phone && (
                <button
                  type="button"
                  className="ml-2 underline disabled:opacity-50"
                  disabled={phoneBusy}
                  onClick={() => void revealPhone()}
                >
                  {phoneBusy ? "…" : "Numarayı göster"}
                </button>
              )}
              {phone && <span className="block opacity-60">Bu görüntüleme denetim kaydına yazıldı.</span>}
              {phoneError && <span className="block text-[#B00020]">{phoneError}</span>}
            </>,
          ],
          ...(can("users.pii")
            ? [
                ["Ad", user.firstName || "—"],
                ["Soyad", user.lastName || "—"],
                ["Doğum", user.birthDate || "—"],
              ]
            : []),
          ["Şehir", user.city || "—"],
          ["Takım", user.teamName || user.teamId || "—"],
          [
            "Taraftar oyu",
            user.vote
              ? `${user.vote.teamName || user.vote.teamId} • ${user.vote.city} • ${formatWhen(user.vote.castAt)}${
                  user.vote.status === "void" ? ` • İPTAL: ${user.vote.voidReason || ""}` : ""
                }`
              : "yok",
          ],
          ["Rol", ROLE_LABELS[user.role] ?? user.role],
          ["Status", user.deleted ? "silindi" : user.status],
          ["Kayıt", formatWhen(user.createdAt)],
          ["Son giriş", formatWhen(user.lastLoginAt)],
          ["Ban", user.banned ? "evet" : "hayır"],
          ["Ban tarihi", formatWhen(user.bannedAt)],
          ["Ban bitiş", user.banExpiresAt ? formatWhen(user.banExpiresAt) : "kalıcı / yok"],
          ["Ban gerekçe", user.banReason || "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="border-[2px] border-black bg-[#FFFEFA] p-2">
            <div className="opacity-50 text-[12px]">{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {!user.banned && !user.deleted && canBanRole(viewer.role, user.role) && (
          <button
            type="button"
            className={btnDanger}
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
        {user.banned && canBanRole(viewer.role, user.role) && (
          <button
            type="button"
            className={btnAccent}
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
        {can("votes.void") && user.vote?.status === "active" && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              ask({
                title: "OYU İPTAL ET",
                body: "Oy sayımdan çıkar ve başka takıma taşınmaz. Üye yeniden oy veremez; yanlışlıkla iptal edildiyse yalnızca süper admin geri alabilir. İşlem denetim kaydına yazılır.",
                confirmLabel: "İPTAL ET",
                onConfirm: async (reason) => {
                  await adminJson(`/api/admin/users/${user.id}/vote`, {
                    method: "DELETE",
                    body: JSON.stringify({ reason }),
                  });
                  await load();
                },
              })
            }
          >
            OYU İPTAL ET
          </button>
        )}
        {can("votes.restore") && user.vote?.status === "void" && !user.deleted && (
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              ask({
                title: "İPTALİ GERİ AL",
                body: "Oy, ilk verildiği takım ve ille aynen sayıma geri döner. Başka takıma taşınamaz. İşlem denetim kaydına yazılır.",
                confirmLabel: "GERİ AL",
                onConfirm: async (reason) => {
                  await adminJson(`/api/admin/users/${user.id}/vote`, {
                    method: "POST",
                    body: JSON.stringify({ reason }),
                  });
                  await load();
                },
              })
            }
          >
            İPTALİ GERİ AL
          </button>
        )}
        {can("roles.manage") && !user.deleted && (
          <div className="flex gap-2 items-center border-[3px] border-black bg-white px-2 py-1">
            <select
              value={nextRole}
              onChange={(e) => setNextRole(e.target.value)}
              className="font-mono text-[12px] bg-white"
              aria-label="Yeni rol"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={nextRole === user.role}
              className="font-anton px-2 py-1 disabled:opacity-40"
              onClick={() =>
                ask({
                  title: "ROL DEĞİŞTİR",
                  body: `${user.username}: ${ROLE_LABELS[user.role] ?? user.role} → ${ROLE_LABELS[nextRole] ?? nextRole}. Oturumları kapanır; son süper admin korunur.`,
                  confirmLabel: "DEĞİŞTİR",
                  onConfirm: async (reason) => {
                    await adminJson(`/api/admin/users/${user.id}/role`, {
                      method: "PUT",
                      body: JSON.stringify({ role: nextRole, reason }),
                    });
                    await load();
                  },
                })
              }
            >
              ROLÜ UYGULA
            </button>
          </div>
        )}
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
