"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import TeamMark from "@/components/TeamMark";
import { FORUM_BODY_MAX, FORUM_POST_MAX, FORUM_TITLE_MAX, FORUM_TITLE_MIN } from "@/lib/policy";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_META,
  isForumCategory,
  tribunTitle,
  type ForumCategory,
} from "@/lib/forum-category";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import { formatForumDate, forumApiError } from "@/lib/forum-ui";
import ForumAuthorName from "@/components/ForumAuthorName";
import { BlockButton, LikeButton, ReportButton } from "@/components/forum/ForumActions";
import { citySlug } from "@/lib/cities";

type Author = { id: number; username: string; isTribunLeader?: boolean };
type Topic = {
  id: number;
  board: "team" | "general" | "city";
  teamId: string | null;
  province: string | null;
  likeCount: number;
  likedByMe: boolean;
  editedAt: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  category: ForumCategory;
  isPinned: boolean;
  author: Author | null;
};
type Post = {
  id: number;
  topicId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
  author: Author;
};

export default function KonuPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const router = useRouter();
  const { user, banned, message, loading } = useAuth();
  const catalog = useTeamCatalog();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState<ForumCategory>("gundem");
  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editPostBody, setEditPostBody] = useState("");
  const limit = 20;

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}?page=${page}&limit=${limit}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Konu bulunamadı.");
        setTopic(null);
        return;
      }
      setTopic(data.topic);
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLoadError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }, [topicId, page]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const team = topic?.teamId ? catalog.getTeam(topic.teamId) : undefined;
  const boardHref = !topic
    ? "/forum"
    : topic.board === "team" && topic.teamId
      ? `/takim/${topic.teamId}/forum`
      : topic.board === "city" && topic.province
        ? `/forum/il/${citySlug(topic.province)}`
        : "/forum/genel";
  const boardLabel = !topic
    ? "Forum"
    : team
      ? tribunTitle(team.name)
      : topic.board === "city" && topic.province
        ? `${topic.province} Tribünü`
        : "Genel Tribün";
  const canWrite = Boolean(user && user.phoneVerified && !banned);
  const pages = Math.max(1, Math.ceil(total / limit));
  const isOwner = Boolean(user && topic && user.id === topic.author?.id);
  const locked = Boolean(topic?.lockedAt);
  const draftOk =
    draft.trim().replace(/\s/g, "").length > 0 && draft.length <= FORUM_POST_MAX;

  async function sendReply() {
    if (!draftOk || sending) return;
    setSending(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(forumApiError(res.status, data.error));
        return;
      }
      setDraft("");
      const created = data.post as Post;
      const lastPage = Math.max(1, Math.ceil((total + 1) / limit));
      if (page === lastPage || total < limit) {
        setPosts((prev) => [...prev, created]);
        setTotal((n) => n + 1);
      } else {
        setPage(lastPage);
      }
    } catch {
      setPostError("Bağlantı kopuk.");
    } finally {
      setSending(false);
    }
  }

  async function saveTopic() {
    const title = editTitle.replace(/\s+/g, " ").trim();
    const content = editBody.trim();
    if (title.length < FORUM_TITLE_MIN || title.length > FORUM_TITLE_MAX) return;
    if (!content.replace(/\s/g, "").length) return;
    setSending(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category: editCategory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(forumApiError(res.status, data.error));
        return;
      }
      setTopic(data.topic);
      setEditing(false);
    } catch {
      setPostError("Bağlantı kopuk.");
    } finally {
      setSending(false);
    }
  }

  async function deleteTopic() {
    if (!confirm("Konuyu silmek istiyor musun?")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setPostError(forumApiError(res.status, data.error));
        return;
      }
      router.push(boardHref);
    } finally {
      setSending(false);
    }
  }

  async function savePost(id: number) {
    const content = editPostBody.trim();
    if (!content.replace(/\s/g, "").length) return;
    setSending(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/forum/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPostError(forumApiError(res.status, data.error));
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === id ? data.post : p)));
      setEditPostId(null);
    } catch {
      setPostError("Bağlantı kopuk.");
    } finally {
      setSending(false);
    }
  }

  async function deletePost(id: number) {
    if (!confirm("Yorumu silmek istiyor musun?")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/forum/posts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setPostError(forumApiError(res.status, data.error));
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((n) => Math.max(0, n - 1));
    } finally {
      setSending(false);
    }
  }

  if (busy && !topic) {
    return (
      <ForumShell>
        <p className="font-mono text-[13px]">Yükleniyor…</p>
      </ForumShell>
    );
  }

  if (loadError || !topic) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">KONU YOK</h1>
        <p className="font-mono text-[13px] mt-2">{loadError}</p>
        <Link href="/forum" className="mt-4 inline-block font-anton border-[3px] border-black px-3 py-2">
          FORUM
        </Link>
      </ForumShell>
    );
  }

  return (
    <ForumShell>
      <Link href={boardHref} className="font-mono text-[11px] underline inline-flex items-center gap-2">
        {team ? <TeamMark team={team} size={22} /> : null}
        {boardLabel}
      </Link>

      <article className="mt-4 border-[4px] border-black bg-[#FFFEFA] shadow-[6px_6px_0_black] p-4 sm:p-5">
        {editing ? (
          <div className="space-y-2">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, FORUM_TITLE_MAX))}
              className="w-full border-[3px] border-black px-2 py-1 font-anton text-[22px]"
            />
            <div className="flex flex-wrap gap-2">
              {FORUM_CATEGORIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEditCategory(key)}
                  className={`font-anton text-[11px] px-2 py-1 border-[2px] border-black ${
                    editCategory === key ? "bg-black text-[#FFEA00]" : "bg-white"
                  }`}
                >
                  {FORUM_CATEGORY_META[key].tab}
                </button>
              ))}
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value.slice(0, FORUM_BODY_MAX))}
              rows={8}
              className="w-full border-[3px] border-black px-2 py-2 font-mono text-[14px]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => void saveTopic()}
                className="font-anton border-[3px] border-black bg-black text-white px-3 py-1"
              >
                KAYDET
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="font-anton border-[3px] border-black px-3 py-1 bg-white"
              >
                VAZGEÇ
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-anton text-[28px] sm:text-[36px] leading-[0.9]">
              {topic.isPinned ? (
                <span className="mr-2 font-mono text-[10px] bg-[#FFEA00] border-[2px] border-black px-1 align-middle">
                  SABİT
                </span>
              ) : null}{" "}
              {topic.title}
            </h1>
            <p className="font-mono text-[11px] opacity-70 mt-2">
              {isForumCategory(topic.category)
                ? FORUM_CATEGORY_META[topic.category].label
                : "Gündem"}{" "}
              •{" "}
              {topic.author ? (
                <ForumAuthorName
                  username={topic.author.username}
                  isTribunLeader={topic.author.isTribunLeader}
                />
              ) : null}{" "}
              • {formatForumDate(topic.createdAt)}
              {topic.editedAt ? " • düzenlendi" : ""}
              {locked ? " • KİLİTLİ" : ""}
            </p>
            <div className="font-mono text-[14px] mt-4 whitespace-pre-wrap leading-[1.5]">
              {topic.content}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <LikeButton
                type="topic"
                id={topic.id}
                count={topic.likeCount}
                liked={topic.likedByMe}
                canLike={canWrite && !isOwner}
              />
              {canWrite && !isOwner && <ReportButton type="topic" id={topic.id} />}
              {canWrite && !isOwner && topic.author && (
                <BlockButton
                  userId={topic.author.id}
                  username={topic.author.username}
                  onBlocked={() => router.push(boardHref)}
                />
              )}
            </div>
            {isOwner && user?.phoneVerified && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditTitle(topic.title);
                    setEditBody(topic.content);
                    setEditCategory(
                      isForumCategory(topic.category) ? topic.category : "gundem",
                    );
                    setEditing(true);
                  }}
                  className="font-anton text-[12px] border-[2px] border-black px-2 py-1 bg-white"
                >
                  DÜZENLE
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void deleteTopic()}
                  className="font-anton text-[12px] border-[2px] border-black px-2 py-1 bg-[#C8102E] text-white"
                >
                  SİL
                </button>
              </div>
            )}
          </>
        )}
      </article>

      <h2 className="font-anton text-[22px] mt-6">YORUMLAR ({total})</h2>
      <div className="mt-2 border-[3px] border-black bg-white divide-y-[2px] divide-black">
        {posts.length === 0 ? (
          <p className="p-4 font-mono text-[13px]">Henüz yorum yok.</p>
        ) : (
          posts.map((p) => (
            <div key={p.id} id={`yorum-${p.id}`} className="p-3 sm:p-4">
              <p className="font-mono text-[11px] opacity-70">
                <ForumAuthorName
                  username={p.author.username}
                  isTribunLeader={p.author.isTribunLeader}
                />{" "}
                • {formatForumDate(p.createdAt)}
                {p.editedAt ? " • düzenlendi" : ""}
              </p>
              {editPostId === p.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editPostBody}
                    onChange={(e) => setEditPostBody(e.target.value.slice(0, FORUM_POST_MAX))}
                    rows={4}
                    className="w-full border-[3px] border-black px-2 py-2 font-mono text-[14px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void savePost(p.id)}
                      className="font-anton text-[12px] border-[2px] border-black px-2 py-1 bg-black text-white"
                    >
                      KAYDET
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPostId(null)}
                      className="font-anton text-[12px] border-[2px] border-black px-2 py-1"
                    >
                      VAZGEÇ
                    </button>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-[14px] mt-1 whitespace-pre-wrap">{p.content}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <LikeButton
                  type="post"
                  id={p.id}
                  count={p.likeCount ?? 0}
                  liked={Boolean(p.likedByMe)}
                  canLike={canWrite && user?.id !== p.author.id}
                />
                {canWrite && user?.id !== p.author.id && <ReportButton type="post" id={p.id} />}
                {canWrite && user?.id !== p.author.id && (
                  <BlockButton
                    userId={p.author.id}
                    username={p.author.username}
                    onBlocked={() => void load()}
                  />
                )}
              </div>
              {user && user.phoneVerified && user.id === p.author.id && editPostId !== p.id && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPostId(p.id);
                      setEditPostBody(p.content);
                    }}
                    className="font-anton text-[11px] underline"
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => void deletePost(p.id)}
                    className="font-anton text-[11px] underline"
                  >
                    Sil
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 font-anton">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-[3px] border-black px-3 py-1 bg-white disabled:opacity-40"
          >
            ←
          </button>
          <span className="font-mono text-[12px]">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="border-[3px] border-black px-3 py-1 bg-white disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      <div className="mt-5 border-[4px] border-black bg-[#FFFEFA] p-4">
        {locked ? (
          <p className="font-anton text-[18px]">BU KONU KİLİTLİ</p>
        ) : banned ? (
          <p className="font-mono text-[13px]">{message || "Hesabın askıda. Yorum yazamazsın."}</p>
        ) : !user && !loading ? (
          <p className="font-mono text-[13px]">
            Yorum yazmak için{" "}
            <Link
              className="underline font-anton"
              href={`/giris?next=${encodeURIComponent(`/forum/konu/${topicId}`)}`}
            >
              giriş yap
            </Link>
            .
          </p>
        ) : user && !user.phoneVerified ? (
          <p className="font-mono text-[13px]">
            Yorum yazmak için{" "}
            <Link href="/takim-sec" className="underline font-anton">
              telefonunu doğrula
            </Link>
            .
          </p>
        ) : (
          <>
            <label className="block">
              <span className="font-mono text-[10px]">YORUM (MAX {FORUM_POST_MAX})</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, FORUM_POST_MAX))}
                rows={4}
                className="mt-1 w-full border-[3px] border-black px-3 py-2 font-mono text-[14px] outline-none"
              />
              <span className="font-mono text-[10px] opacity-60">
                {draft.length}/{FORUM_POST_MAX}
              </span>
            </label>
            {postError && (
              <p className="mt-2 font-mono text-[12px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10">
                {postError}
              </p>
            )}
            <button
              type="button"
              disabled={sending || !draftOk || !user}
              onClick={() => void sendReply()}
              className="mt-2 font-anton text-[16px] px-4 py-2 border-[3px] border-black bg-black text-white disabled:bg-zinc-300 disabled:text-zinc-500"
            >
              {sending ? "GÖNDERİLİYOR…" : "YORUMU GÖNDER"}
            </button>
          </>
        )}
      </div>
    </ForumShell>
  );
}
