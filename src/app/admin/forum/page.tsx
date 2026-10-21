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
import { btnPrimary, btnSm, btnSmDanger, chipClass, fieldClass, labelClass } from "@/components/ui";
import { useTeamCatalog } from "@/components/useTeamCatalog";

type BoardInfo = {
  teamId: string | null;
  teamName: string | null;
  board?: string;
  city?: string | null;
};

type Topic = BoardInfo & {
  id: number;
  title: string;
  createdAt: string;
  locked: boolean;
  deleted: boolean;
  held?: boolean;
  postCount: number;
  author: { id: number; username: string };
};

type Post = BoardInfo & {
  id: number;
  topicId: number;
  topicTitle: string;
  content: string;
  createdAt: string;
  deleted: boolean;
  author: { id: number; username: string };
};

/** "Galatasaray", "Genel Tribün" or "İl: Eskişehir". */
function boardName(row: BoardInfo) {
  if (row.board === "general") return "Genel Tribün";
  if (row.board === "city") return row.city ? `İl: ${row.city}` : "İl tribünü";
  return row.teamName || row.teamId || "—";
}

function topicStatus(t: Topic) {
  if (t.deleted) return "silindi";
  if (t.held) return "incelemede";
  return t.locked ? "kilitli" : "açık";
}

export default function AdminForumPage() {
  const { ask, dialog } = useConfirmAction();
  const { forumTeams } = useTeamCatalog();
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
    if (team) params.set("team", team);
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
    void Promise.resolve().then(load);
  }, [load]);

  function banAuthor(userId: number, username: string) {
    ask({
      title: "KULLANICIYI BANLA",
      body: `${username} banlanacak. Tribünde yazamaz.`,
      confirmLabel: "BANLA",
      busyLabel: "BANLANIYOR…",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/users/${userId}/ban`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        await load();
      },
    });
  }

  function lockTopic(t: Topic) {
    ask({
      title: t.locked ? "KİLİDİ AÇ" : "KONUYU KİLİTLE",
      body: t.title,
      confirmLabel: t.locked ? "KİLİDİ AÇ" : "KİLİTLE",
      busyLabel: t.locked ? "AÇILIYOR…" : "KİLİTLENİYOR…",
      tone: "primary",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/forum/topics/${t.id}/${t.locked ? "unlock" : "lock"}`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        await load();
      },
    });
  }

  function deleteTopic(t: Topic) {
    ask({
      title: "KONUYU SİL",
      body: t.title,
      confirmLabel: "SİL",
      busyLabel: "SİLİNİYOR…",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/forum/topics/${t.id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        });
        await load();
      },
    });
  }

  function deletePost(p: Post) {
    ask({
      title: "MESAJI SİL",
      body: "Mesaj tribünde artık görünmez.",
      confirmLabel: "SİL",
      busyLabel: "SİLİNİYOR…",
      onConfirm: async (reason) => {
        await adminJson(`/api/admin/forum/posts/${p.id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        });
        await load();
      },
    });
  }

  const topicActions = (t: Topic) => (
    <div className="flex flex-wrap gap-2">
      {!t.deleted && (
        <button type="button" className={btnSm} onClick={() => lockTopic(t)}>
          {t.locked ? "KİLİDİ AÇ" : "KİLİTLE"}
        </button>
      )}
      <button type="button" className={btnSm} onClick={() => banAuthor(t.author.id, t.author.username)}>
        BANLA
      </button>
      {!t.deleted && (
        <button type="button" className={`${btnSmDanger} ml-auto md:ml-0`} onClick={() => deleteTopic(t)}>
          SİL
        </button>
      )}
    </div>
  );

  const postActions = (p: Post) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btnSm} onClick={() => banAuthor(p.author.id, p.author.username)}>
        BANLA
      </button>
      {!p.deleted && (
        <button type="button" className={`${btnSmDanger} ml-auto md:ml-0`} onClick={() => deletePost(p)}>
          SİL
        </button>
      )}
    </div>
  );

  const topicLink = (id: number, title: string) => (
    <Link
      href={`/forum/konu/${id}`}
      target="_blank"
      rel="noopener"
      className="underline underline-offset-4 font-bold"
    >
      {title}
      <span className="sr-only"> (yeni sekmede açılır)</span>
      <span aria-hidden="true"> ↗</span>
    </Link>
  );

  return (
    <div>
      {dialog}
      <h2 className="font-anton text-[32px] leading-none">FORUM</h2>
      <div className="flex gap-2 mt-3" role="group" aria-label="Görünüm">
        <button
          type="button"
          aria-pressed={tab === "topics"}
          onClick={() => {
            setTab("topics");
            setPage(1);
          }}
          className={chipClass(tab === "topics")}
        >
          KONULAR
        </button>
        <button
          type="button"
          aria-pressed={tab === "posts"}
          onClick={() => {
            setTab("posts");
            setPage(1);
          }}
          className={chipClass(tab === "posts")}
        >
          MESAJLAR
        </button>
      </div>
      <form
        className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="block">
          <span className={labelClass}>{tab === "topics" ? "BAŞLIKTA ARA" : "MESAJDA ARA"}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>TRİBÜN</span>
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setPage(1);
            }}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="">Hepsi</option>
            <option value="board:general">Genel Tribün</option>
            <optgroup label="Takım tribünleri">
              {forumTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>DURUM</span>
          <select
            value={deleted}
            onChange={(e) => {
              setDeleted(e.target.value);
              setPage(1);
            }}
            className={`mt-1 ${fieldClass}`}
          >
            <option value="all">Hepsi</option>
            <option value="live">Yayında</option>
            <option value="deleted">Silinmiş</option>
          </select>
        </label>
        <button type="submit" className={btnPrimary}>
          FİLTRELE
        </button>
      </form>

      {error && <div className="mt-3"><AdminNotice kind="error">{error}</AdminNotice></div>}
      {loading && <div className="mt-3"><AdminNotice kind="loading">Yükleniyor…</AdminNotice></div>}

      {!loading && tab === "topics" && topics.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Bu filtreyle konu yok.</AdminNotice></div>
      )}
      {!loading && tab === "topics" && topics.length > 0 && (
        <>
          <ul className="md:hidden mt-3 space-y-3">
            {topics.map((t) => (
              <li key={t.id} className="border-[3px] border-black bg-[#FFFEFA] p-3 font-mono text-[13px]">
                <p className="text-[12px] opacity-75">
                  {boardName(t)} • {topicStatus(t)} • {t.postCount} yorum
                </p>
                <p className="mt-1 text-[15px]">{topicLink(t.id, t.title)}</p>
                <p className="mt-1 text-[12px]">
                  <Link className="underline underline-offset-4" href={`/admin/uyeler/${t.author.id}`}>
                    @{t.author.username}
                  </Link>{" "}
                  • {formatWhen(t.createdAt)}
                </p>
                <div className="mt-3 pt-3 border-t-[2px] border-dashed border-black">{topicActions(t)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
            <table className="w-full text-left font-mono text-[13px]">
              <thead className="bg-black text-[#FFEA00]">
                <tr>
                  <th className="p-2">Tribün</th>
                  <th className="p-2">Başlık</th>
                  <th className="p-2">Yazar</th>
                  <th className="p-2">Tarih</th>
                  <th className="p-2">Yorum</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t.id} className="border-t-[2px] border-black align-top">
                    <td className="p-2">{boardName(t)}</td>
                    <td className="p-2">{topicLink(t.id, t.title)}</td>
                    <td className="p-2">
                      <Link className="underline" href={`/admin/uyeler/${t.author.id}`}>
                        {t.author.username}
                      </Link>
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatWhen(t.createdAt)}</td>
                    <td className="p-2">{t.postCount}</td>
                    <td className="p-2">{topicStatus(t)}</td>
                    <td className="p-2 min-w-[220px]">{topicActions(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === "posts" && posts.length === 0 && (
        <div className="mt-3"><AdminNotice kind="empty">Bu filtreyle mesaj yok.</AdminNotice></div>
      )}
      {!loading && tab === "posts" && posts.length > 0 && (
        <>
          <ul className="md:hidden mt-3 space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="border-[3px] border-black bg-[#FFFEFA] p-3 font-mono text-[13px]">
                <p className="text-[12px] opacity-75">
                  {boardName(p)} • {formatWhen(p.createdAt)}
                </p>
                <p className="mt-1">Konu: {topicLink(p.topicId, p.topicTitle)}</p>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {p.deleted ? <span className="opacity-60">(silindi) </span> : null}
                  {p.content}
                </p>
                <p className="mt-1 text-[12px]">
                  <Link className="underline underline-offset-4" href={`/admin/uyeler/${p.author.id}`}>
                    @{p.author.username}
                  </Link>
                </p>
                <div className="mt-3 pt-3 border-t-[2px] border-dashed border-black">{postActions(p)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto border-[3px] border-black bg-[#FFFEFA] mt-3">
            <table className="w-full text-left font-mono text-[13px]">
              <thead className="bg-black text-[#FFEA00]">
                <tr>
                  <th className="p-2">Tribün</th>
                  <th className="p-2">Konu</th>
                  <th className="p-2">Yazar</th>
                  <th className="p-2">Mesaj</th>
                  <th className="p-2">Tarih</th>
                  <th className="p-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t-[2px] border-black align-top">
                    <td className="p-2">{boardName(p)}</td>
                    <td className="p-2">{topicLink(p.topicId, p.topicTitle)}</td>
                    <td className="p-2">
                      <Link className="underline" href={`/admin/uyeler/${p.author.id}`}>
                        {p.author.username}
                      </Link>
                    </td>
                    <td className="p-2 max-w-[280px] break-words">
                      {p.deleted ? <span className="opacity-60">(silindi) </span> : null}
                      {p.content}
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatWhen(p.createdAt)}</td>
                    <td className="p-2 min-w-[160px]">{postActions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AdminPager page={page} limit={limit} total={total} onPage={setPage} />
    </div>
  );
}
