"use client";

import Link from "next/link";
import { useState } from "react";
import { formatForumDate } from "@/lib/forum-ui";

type Item = {
  type: "topic" | "post";
  id: number;
  topicId: number;
  title: string;
  excerpt: string;
  createdAt: string;
};

export default function ProfileActivity({
  username,
  initial,
  initialHasMore,
}: {
  username: string;
  initial: Item[];
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/activity?page=${page + 1}`);
      const data = (await res.json()) as { items?: Item[]; hasMore?: boolean; error?: string };
      if (!res.ok || !data.items) throw new Error(data.error || "Yüklenemedi.");
      setItems((prev) => [...prev, ...data.items!]);
      setHasMore(Boolean(data.hasMore));
      setPage((p) => p + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return <p className="font-mono text-[12px] opacity-70 mt-2">Henüz yayında bir konu veya yorum yok.</p>;
  }
  return (
    <>
      <ul className="mt-3 border-[3px] border-black bg-white divide-y-[2px] divide-black">
        {items.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <Link
              href={item.type === "topic" ? `/forum/konu/${item.topicId}` : `/forum/konu/${item.topicId}#yorum-${item.id}`}
              className="block p-3 hover:bg-[#FFEA00]/30"
            >
              <p className="font-mono text-[10px] opacity-70">
                {item.type === "topic" ? "KONU AÇTI" : "YORUM YAZDI"} • {formatForumDate(item.createdAt)}
              </p>
              <p className="font-anton text-[16px] leading-tight">{item.title}</p>
              <p className="font-mono text-[12px] mt-1 line-clamp-2 break-words">{item.excerpt}</p>
            </Link>
          </li>
        ))}
      </ul>
      {error && <p className="font-mono text-[12px] text-[#C8102E] mt-2">{error}</p>}
      {hasMore && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void more()}
          className="mt-3 font-anton text-[14px] border-[3px] border-black bg-white px-3 py-2 disabled:opacity-50"
        >
          {busy ? "YÜKLENİYOR…" : "DAHA FAZLA"}
        </button>
      )}
    </>
  );
}
