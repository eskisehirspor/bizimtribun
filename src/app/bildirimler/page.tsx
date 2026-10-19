"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import { formatForumDate } from "@/lib/forum-ui";

type Item = {
  id: number;
  kind: string;
  topicId: number | null;
  postId: number | null;
  body: string;
  readAt: string | null;
  createdAt: string;
  actor: string | null;
};

const KIND_LABEL: Record<string, string> = {
  reply: "YANIT",
  like: "BEĞENİ",
  mention: "ANMA",
  moderation: "MODERASYON",
  badge: "ROZET",
  system: "SİSTEM",
};

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yüklenemedi.");
      setItems(data.items);
      setUnread(data.unread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    if (user) void Promise.resolve().then(load);
  }, [user, load]);

  async function markAll() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: "all" }),
    });
    await load();
  }

  async function open(item: Item) {
    if (!item.readAt) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
    }
  }

  return (
    <ForumShell>
      <p className="font-mono text-[10px] tracking-[0.16em]">BİZİM TRİBÜN • HESAP</p>
      <h1 className="font-anton text-[40px] leading-[0.85] mt-2">BİLDİRİMLER</h1>
      {!loading && !user && (
        <p className="font-mono text-[13px] mt-4">
          Bildirimleri görmek için{" "}
          <Link className="underline" href="/giris?next=/bildirimler">
            giriş yap
          </Link>
          .
        </p>
      )}
      {error && <p className="font-mono text-[12px] mt-4">{error}</p>}
      {user && items && (
        <>
          <div className="flex items-center gap-3 mt-4">
            <span className="font-mono text-[12px]">{unread} okunmamış</span>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="font-mono text-[12px] underline">
                Hepsini okundu yap
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="font-mono text-[13px] mt-4">Henüz bildirim yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((n) => {
                const href = n.topicId
                  ? `/forum/konu/${n.topicId}${n.postId ? `#yorum-${n.postId}` : ""}`
                  : null;
                const inner = (
                  <div
                    className={`border-[3px] border-black p-3 font-mono text-[12px] ${
                      n.readAt ? "bg-[#FFFEFA]" : "bg-[#FFEA00]"
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-[10px] opacity-70">
                      <span>{KIND_LABEL[n.kind] ?? n.kind}</span>
                      <span>{formatForumDate(n.createdAt)}</span>
                    </div>
                    <p className="mt-1">{n.body}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} onClick={() => void open(n)}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" className="w-full text-left" onClick={() => void open(n).then(load)}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="font-mono text-[11px] mt-4 opacity-70">
            Bildirimler yalnızca sitede görünür; SMS veya e-posta gönderilmez. 90 günden eski
            bildirimler silinir.
          </p>
        </>
      )}
    </ForumShell>
  );
}
