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

type Topic = {
  id: number;
  teamId: string;
  teamName: string | null;
  title: string;
  createdAt: string;
  locked: boolean;
  deleted: boolean;
  postCount: number;
  author: { id: number; username: string };
};

type Post = {
  id: number;
  topicId: number;
  topicTitle: string;
  teamId: string;
  teamName: string | null;
  content: string;
  createdAt: string;
  deleted: boolean;
  author: { id: number; username: string };
};

export default function AdminForumPage() {
  const { ask, dialog } = useConfirmAction();
  const [tab, setTab] = useState<"topics" | "posts">("topics");
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("");
  const [deleted, setDeleted] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "25", deleted });
    if (q.trim()) params.set("q", q.trim());
    if (team.trim()) params.set("team", team.trim());
    try {
      if (tab === "topics") {
        const data = await adminJson<{ items: Topic[]; total: number; limit: number }>(
          `/api/admin/forum/topics?${params}`,
        );
        setTopics(data.items);
        setPosts([]);
        setTotal(data.total);
        setLimit(data.limit);
      } else {
        const data = await adminJson<{ items: Post[]; total: number; limit: number }>(
          `/api/admin/forum/posts?${params}`,
        );
        setPosts(data.items);
        setTopics([]);
        setTotal(data.total);
        setLimit(data.limit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [tab, q, team, deleted, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function banAuthor(userId: number, username: string) {
    ask({
      title: "KULLANICIYI BANLA",
      body: `${username} banlanacak.`,
      confirmLabel: "BANLA",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/users/${userId}/ban`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        await load();
      },
    });
  }

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">FORUM</h2>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            setTab("topics");
            setPage(1);
          }}
          className={`font-anton border-[3px] border-black px-3 py-1 ${tab === "topics" ? "bg-[#FFEA00]" : "bg-white"}`}
        >
          KONULAR
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("posts");
            setPage(1);
          }}
          className={`font-anton border-[3px] border-black px-3 py-1 ${tab === "posts" ? "bg-[#FFEA00]" : "bg-white"}`}
        >
          MESAJLAR
        </button>
      </div>
      <form
        className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "topics" ? "başlık" : "mesaj"}
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        />
        <input
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          placeholder="takım id"
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        />
        <select
          value={deleted}
          onChange={(e) => {
            setDeleted(e.target.value);
            setPage(1);
          }}
          className="border-[3px] border-black px-2 py-2 font-mono text-[13px]"
        >
          <option value="all">hepsi</option>
          <option value="live">canlı</option>
          <option value="deleted">silindi</option>
        </select>
        <button type="submit" className="font-anton border-[3px] border-black bg-[#FFEA00]">
          FİLTRELE
        </button>
      </form>

      {error && <div className="mt-3"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {loading && <div className="mt-3"><AdminNotice kind="loading">Yükleniyor…</AdminNotice></div>}

      {!loading && tab === "topics" && topics.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Konu yok.</AdminNotice></div>
      )}
      {!loading && tab === "topics" && topics.length > 0 && (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Takım</th>
                <th className="p-2">Başlık</th>
                <th className="p-2">Yazar</th>
                <th className="p-2">Tarih</th>
                <th className="p-2">Yorum</th>
                <th className="p-2">Durum</th>
                <th className="p-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.id} className="border-t-[2px] border-black align-top">
                  <td className="p-2">{t.teamName || t.teamId}</td>
                  <td className="p-2">{t.title}</td>
                  <td className="p-2">
                    <Link className="underline" href={`/admin/uyeler/${t.author.id}`}>
                      {t.author.username}
                    </Link>
                  </td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(t.createdAt)}</td>
                  <td className="p-2">{t.postCount}</td>
                  <td className="p-2">
                    {t.deleted ? "silindi" : t.locked ? "kilitli" : "açık"}
                  </td>
                  <td className="p-2 space-y-1">
                    {!t.deleted && (
                      <>
                        <button
                          type="button"
                          className="block border-[2px] border-black px-2 bg-white"
                          onClick={() =>
                            ask({
                              title: t.locked ? "KİLİDİ AÇ" : "KİLİTLE",
                              body: t.title,
                              confirmLabel: t.locked ? "AÇ" : "KİLİTLE",
                              onConfirm: async (reason) => {
                                await adminJson(
                                  `/api/admin/forum/topics/${t.id}/${t.locked ? "unlock" : "lock"}`,
                                  { method: "POST", body: JSON.stringify({ reason }) },
                                );
                                await load();
                              },
                            })
                          }
                        >
                          {t.locked ? "kilit aç" : "kilitle"}
                        </button>
                        <button
                          type="button"
                          className="block border-[2px] border-black px-2 bg-[#C8102E] text-white"
                          onClick={() =>
                            ask({
                              title: "KONU SİL",
                              body: t.title,
                              confirmLabel: "SİL",
                              onConfirm: async (reason) => {
                                await adminJson(`/api/admin/forum/topics/${t.id}`, {
                                  method: "DELETE",
                                  body: JSON.stringify({ reason }),
                                });
                                await load();
                              },
                            })
                          }
                        >
                          sil
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="block border-[2px] border-black px-2 bg-white"
                      onClick={() => banAuthor(t.author.id, t.author.username)}
                    >
                      banla
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "posts" && posts.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Mesaj yok.</AdminNotice></div>
      )}
      {!loading && tab === "posts" && posts.length > 0 && (
        <div className="overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
          <table className="w-full text-left font-mono text-[12px]">
            <thead className="bg-black text-[#FFEA00]">
              <tr>
                <th className="p-2">Takım</th>
                <th className="p-2">Konu</th>
                <th className="p-2">Yazar</th>
                <th className="p-2">Mesaj</th>
                <th className="p-2">Tarih</th>
                <th className="p-2">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t-[2px] border-black align-top">
                  <td className="p-2">{p.teamName || p.teamId}</td>
                  <td className="p-2">{p.topicTitle}</td>
                  <td className="p-2">
                    <Link className="underline" href={`/admin/uyeler/${p.author.id}`}>
                      {p.author.username}
                    </Link>
                  </td>
                  <td className="p-2 max-w-[280px]">
                    {p.deleted ? <span className="opacity-50">(silindi) </span> : null}
                    {p.content}
                  </td>
                  <td className="p-2 whitespace-nowrap">{formatWhen(p.createdAt)}</td>
                  <td className="p-2 space-y-1">
                    {!p.deleted && (
                      <button
                        type="button"
                        className="block border-[2px] border-black px-2 bg-[#C8102E] text-white"
                        onClick={() =>
                          ask({
                            title: "MESAJ SİL",
                            body: "Public forumda görünmez.",
                            confirmLabel: "SİL",
                            onConfirm: async (reason) => {
                              await adminJson(`/api/admin/forum/posts/${p.id}`, {
                                method: "DELETE",
                                body: JSON.stringify({ reason }),
                              });
                              await load();
                            },
                          })
                        }
                      >
                        sil
                      </button>
                    )}
                    <button
                      type="button"
                      className="block border-[2px] border-black px-2 bg-white"
                      onClick={() => banAuthor(p.author.id, p.author.username)}
                    >
                      banla
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPager page={page} limit={limit} total={total} onPage={setPage} />
    </div>
  );
}
