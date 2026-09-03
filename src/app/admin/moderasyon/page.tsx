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

type AuditItem = {
  id: number;
  action: string;
  reason: string | null;
  createdAt: string;
  moderator: { id: number; username: string };
  targetUser: { id: number; username: string | null } | null;
  targetTopicId: number | null;
  targetPostId: number | null;
};

type AuditRes = { items: AuditItem[]; total: number; limit: number };

type HeldItem = {
  kind: "topic" | "post";
  id: number;
  teamId: string;
  teamName: string;
  title: string;
  content: string;
  heldAt: string;
  username: string;
  userId: number;
  topicId: number;
  autoReviewId: number | null;
  category: string | null;
  severity: string | null;
  ruleId: string | null;
  autoReason: string | null;
};

type HeldRes = { items: HeldItem[]; total: number; limit: number; page: number };

export default function AdminModerationPage() {
  const { ask, dialog } = useConfirmAction();
  const [action, setAction] = useState("");
  const [moderator, setModerator] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditRes | null>(null);
  const [held, setHeld] = useState<HeldRes | null>(null);
  const [heldPage, setHeldPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heldLoading, setHeldLoading] = useState(true);

  const loadHeld = useCallback(async () => {
    setHeldLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(heldPage),
        limit: "25",
      });
      setHeld(await adminJson<HeldRes>(`/api/admin/moderation/held?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuyruk yüklenemedi.");
    } finally {
      setHeldLoading(false);
    }
  }, [heldPage]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (action) params.set("action", action);
    if (moderator.trim()) params.set("moderator", moderator.trim());
    if (user.trim()) params.set("user", user.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      setData(await adminJson<AuditRes>(`/api/admin/moderation?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [action, moderator, user, from, to, page]);

  useEffect(() => {
    void loadHeld();
  }, [loadHeld]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runHeld(
    item: HeldItem,
    actionPath: "approve" | "reject" | "ban",
    reason: string,
  ) {
    await adminJson(`/api/admin/moderation/${item.kind}/${item.id}/${actionPath}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    await Promise.all([loadHeld(), load()]);
  }

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">MODERASYON</h2>
      <p className="font-mono text-[12px] mt-2">
        Bekleyen: {heldLoading ? "…" : held?.total ?? 0}
      </p>

      <h3 className="font-anton text-[22px] mt-6">BEKLEYEN İÇERİKLER</h3>
      {heldLoading && (
        <div className="mt-3">
          <AdminNotice kind="loading">Kuyruk yükleniyor…</AdminNotice>
        </div>
      )}
      {!heldLoading && held && held.items.length === 0 && (
        <div className="mt-3">
          <AdminNotice kind="empty">Bekleyen içerik yok.</AdminNotice>
        </div>
      )}
      {!heldLoading && held && held.items.length > 0 && (
        <div className="mt-3 space-y-3">
          {held.items.map((item) => (
            <article
              key={`${item.kind}-${item.id}`}
              className="border-[3px] border-black bg-[#FFFEFA] p-3 shadow-[4px_4px_0_black]"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="bg-black text-[#FFEA00] px-2 py-1">
                  {item.kind === "topic" ? "KONU" : "YORUM"}
                </span>
                <span>{item.teamName}</span>
                <span className="opacity-50">#{item.id}</span>
                <span className="opacity-60">{formatWhen(item.heldAt)}</span>
              </div>
              <p className="font-anton text-[20px] leading-none mt-2">{item.title}</p>
              <p className="font-mono text-[12px] mt-1">
                <Link className="underline" href={`/admin/uyeler/${item.userId}`}>
                  {item.username}
                </Link>
              </p>
              <p className="font-mono text-[13px] mt-2 whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                {item.content}
              </p>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[11px] opacity-80">
                <div>kategori: {item.category || "—"}</div>
                <div>severity: {item.severity || "—"}</div>
                <div>rule: {item.ruleId || "—"}</div>
                <div>auto_review: {item.autoReviewId ?? "—"}</div>
                <div className="sm:col-span-2 truncate" title={item.autoReason || ""}>
                  auto reason: {item.autoReason || "—"}
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="font-anton text-[13px] border-[3px] border-black bg-[#FFEA00] px-3 py-1"
                  onClick={() =>
                    ask({
                      title: "YAYINLA",
                      body: "Bu içerik herkese açık hale gelir.",
                      confirmLabel: "YAYINLA",
                      requireReason: false,
                      onConfirm: (reason) => runHeld(item, "approve", reason),
                    })
                  }
                >
                  YAYINLA
                </button>
                <button
                  type="button"
                  className="font-anton text-[13px] border-[3px] border-black bg-white px-3 py-1"
                  onClick={() =>
                    ask({
                      title: "SİL",
                      body: "İçerik reddedilir ve public görünmez.",
                      confirmLabel: "SİL",
                      onConfirm: (reason) => runHeld(item, "reject", reason),
                    })
                  }
                >
                  SİL
                </button>
                <button
                  type="button"
                  className="font-anton text-[13px] border-[3px] border-black bg-[#C8102E] text-white px-3 py-1"
                  onClick={() =>
                    ask({
                      title: "KULLANICIYI BANLA",
                      body: `${item.username} banlanır, içerik reddedilir ve public kalmaz.`,
                      confirmLabel: "BANLA",
                      onConfirm: (reason) => runHeld(item, "ban", reason),
                    })
                  }
                >
                  KULLANICIYI BANLA
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {held && (
        <AdminPager
          page={heldPage}
          limit={held.limit}
          total={held.total}
          onPage={setHeldPage}
        />
      )}

      <h3 className="font-anton text-[22px] mt-8">DENETİM KAYITLARI</h3>
      <form
        className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="border-[3px] border-black px-2 py-2 font-mono text-[12px]"
        >
          <option value="">işlem: hepsi</option>
          <option value="ban_user">ban_user</option>
          <option value="unban_user">unban_user</option>
          <option value="promote_admin">promote_admin</option>
          <option value="demote_admin">demote_admin</option>
          <option value="lock_topic">lock_topic</option>
          <option value="unlock_topic">unlock_topic</option>
          <option value="delete_topic">delete_topic</option>
          <option value="delete_post">delete_post</option>
          <option value="auto_review">auto_review</option>
          <option value="approve_moderation">approve_moderation</option>
          <option value="reject_moderation">reject_moderation</option>
        </select>
        <input
          value={moderator}
          onChange={(e) => setModerator(e.target.value)}
          placeholder="moderator username/id"
          className="border-[3px] border-black px-2 py-2 font-mono text-[12px]"
        />
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="hedef user id"
          className="border-[3px] border-black px-2 py-2 font-mono text-[12px]"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border-[3px] border-black px-2 py-2 font-mono text-[12px]"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border-[3px] border-black px-2 py-2 font-mono text-[12px]"
        />
        <button type="submit" className="font-anton border-[3px] border-black bg-[#FFEA00]">
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
                <th className="p-2">Tarih</th>
                <th className="p-2">Mod</th>
                <th className="p-2">İşlem</th>
                <th className="p-2">Hedef üye</th>
                <th className="p-2">Konu</th>
                <th className="p-2">Mesaj</th>
                <th className="p-2">Gerekçe</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id} className="border-t-[2px] border-black">
                  <td className="p-2 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                  <td className="p-2">{row.moderator.username}</td>
                  <td className="p-2">{row.action}</td>
                  <td className="p-2">
                    {row.targetUser ? (
                      <Link className="underline" href={`/admin/uyeler/${row.targetUser.id}`}>
                        {row.targetUser.username || row.targetUser.id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2">{row.targetTopicId ?? "—"}</td>
                  <td className="p-2">{row.targetPostId ?? "—"}</td>
                  <td className="p-2 max-w-[240px] truncate">{row.reason || "—"}</td>
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
