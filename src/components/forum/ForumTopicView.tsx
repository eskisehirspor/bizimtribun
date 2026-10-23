"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ForumShell from "@/components/ForumShell";
import TeamBoardGate, { isTeamBoardCode } from "@/components/forum/TeamBoardGate";
import TeamMark from "@/components/TeamMark";
import { FORUM_PAGE_DEFAULT, FORUM_POST_MAX } from "@/lib/policy";
import { FORUM_CATEGORY_META, isForumCategory, tribunTitle, type ForumCategory } from "@/lib/forum-category";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import { formatForumDate, forumApiError } from "@/lib/forum-ui";
import ForumAuthorName from "@/components/ForumAuthorName";
import {
  BlockButton,
  LikeButton,
  ReportButton,
  type LikeViewer,
} from "@/components/forum/ForumActions";
import BackLink from "@/components/BackLink";
import ConfirmDialog from "@/components/ConfirmDialog";
import Pager from "@/components/Pager";
import { NATIONAL_BOARD_NAME, NATIONAL_BOARD_PATH } from "@/lib/national-board";
import {
  btnPrimary,
  btnSecondary,
  btnSmDanger,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui";

type Author = { id: number; username: string; isFanOfWeek?: boolean };
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

const limit = FORUM_PAGE_DEFAULT;

/** First page as the server rendered it, so the topic is in the HTML for readers and search engines. */
export type TopicInitial = { topic: Topic; posts: Post[]; total: number };

export default function KonuPage({ initial }: { initial?: TopicInitial }) {
  const { topicId } = useParams<{ topicId: string }>();
  const router = useRouter();
  const { user, banned, message, loading } = useAuth();
  const catalog = useTeamCatalog();
  const [topic, setTopic] = useState<Topic | null>(initial?.topic ?? null);
  const [posts, setPosts] = useState<Post[]>(initial?.posts ?? []);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  /** Pending delete: the topic itself or one of the viewer's comments. */
  const [deleting, setDeleting] = useState<{ kind: "topic" } | { kind: "post"; id: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}?page=${page}&limit=${limit}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setGated(isTeamBoardCode(data.code));
        setLoadError(data.error || "Konu bulunamadı.");
        setTopic(null);
        return;
      }
      setGated(false);
      setTopic(data.topic);
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setLoadError("Bağlantı kopuk.");
    } finally {
      setBusy(false);
    }
  }, [topicId, page]);

  const viewerId = user?.id;
  useEffect(() => {
    void Promise.resolve().then(load);
    // Reload when the viewer signs in or out: team tribunes depend on who is looking.
  }, [load, viewerId]);

  const team = topic?.teamId ? catalog.getTeam(topic.teamId) : undefined;
  const boardHref = !topic
    ? "/forum"
    : topic.board === "team" && topic.teamId
      ? `/takim/${topic.teamId}/forum`
      : NATIONAL_BOARD_PATH;
  const boardLabel = !topic
    ? "Tribün"
    : team
      ? tribunTitle(team.name)
      : NATIONAL_BOARD_NAME;
  const canWrite = Boolean(user && user.verified && !banned);
  const pages = Math.max(1, Math.ceil(total / limit));
  const isOwner = Boolean(user && topic && user.id === topic.author?.id);
  const locked = Boolean(topic?.lockedAt);
  const draftOk =
    draft.trim().replace(/\s/g, "").length > 0 && draft.length <= FORUM_POST_MAX;
  const topicPath = `/forum/konu/${topicId}`;
  const likeViewer = (authorId: number | undefined): LikeViewer =>
    !user
      ? loading
        ? "none"
        : "guest"
      : banned
        ? "none"
        : !user.verified
          ? "unverified"
          : user.id === authorId
            ? "author"
            : "can";

  async function sendReply() {
    if (sending) return;
    if (!draftOk) {
      setPostError("Yorum boş olamaz. Bir şeyler yaz.");
      return;
    }
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

  async function deleteTopic() {
    setSending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/forum/topics/${topicId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(forumApiError(res.status, data.error));
        return;
      }
      setDeleting(null);
      router.push(boardHref);
    } catch {
      setDeleteError("Bağlantı kopuk.");
    } finally {
      setSending(false);
    }
  }

  async function deletePost(id: number) {
    setSending(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/forum/posts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(forumApiError(res.status, data.error));
        return;
      }
      setDeleting(null);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setTotal((n) => Math.max(0, n - 1));
    } catch {
      setDeleteError("Bağlantı kopuk.");
    } finally {
      setSending(false);
    }
  }

  if (busy && !topic) {
    return (
      <ForumShell>
        <p className="font-mono text-[14px]" aria-busy="true">
          Konu yükleniyor…
        </p>
      </ForumShell>
    );
  }

  if (gated) {
    return <TeamBoardGate title="Takım tribünü" next={topicPath} />;
  }

  if (loadError || !topic) {
    return (
      <ForumShell>
        <h1 className="font-anton text-[32px]">KONU YOK</h1>
        <p className="font-mono text-[14px] mt-2">{loadError}</p>
        <Link href="/forum" className={`mt-4 ${btnSecondary}`}>
          ← TRİBÜNE DÖN
        </Link>
      </ForumShell>
    );
  }

  const deletingPost = deleting?.kind === "post" ? deleting.id : null;

  return (
    <ForumShell>
      <BackLink href={boardHref}>
        {team ? <TeamMark team={team} size={22} /> : null}
        {boardLabel}
      </BackLink>

      <article className="mt-3 border-[4px] border-black bg-[#FFFEFA] shadow-[6px_6px_0_black] p-4 sm:p-5">
        <>
            <h1 className="font-anton text-[28px] sm:text-[36px] leading-[1.05]">
              {topic.isPinned ? (
                <span className="mr-2 font-mono text-[11px] bg-[#FFEA00] border-[2px] border-black px-1 align-middle">
                  SABİT
                </span>
              ) : null}{" "}
              {topic.title}
            </h1>
            <p className="font-mono text-[12px] opacity-75 mt-2">
              {isForumCategory(topic.category)
                ? FORUM_CATEGORY_META[topic.category].label
                : "Genel Sohbet"}{" "}
              •{" "}
              {topic.author ? (
                <ForumAuthorName
                  link
                  username={topic.author.username}
                  isFanOfWeek={topic.author.isFanOfWeek}
                />
              ) : null}{" "}
              • {formatForumDate(topic.createdAt)}
              {topic.editedAt ? " • düzenlendi" : ""}
              {locked ? " • KİLİTLİ" : ""}
            </p>
            <div className="font-mono text-[15px] mt-4 whitespace-pre-wrap leading-[1.55]">
              {topic.content}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <LikeButton
                type="topic"
                id={topic.id}
                count={topic.likeCount}
                liked={topic.likedByMe}
                viewer={likeViewer(topic.author?.id)}
                loginNext={topicPath}
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
            {isOwner && user?.verified && (
              <div className="mt-4 pt-3 border-t-[2px] border-dashed border-black flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting({ kind: "topic" });
                  }}
                  className={`${btnSmDanger} ml-auto`}
                >
                  KONUYU SİL
                </button>
              </div>
            )}
        </>
      </article>

      <h2 className="font-anton text-[22px] mt-6">YORUMLAR ({total})</h2>
      <div className="mt-2 border-[3px] border-black bg-white divide-y-[2px] divide-black">
        {posts.length === 0 ? (
          <p className="p-4 font-mono text-[14px]">Henüz yorum yok. İlk yorumu sen yaz.</p>
        ) : (
          posts.map((p) => {
            const mine = Boolean(user && user.id === p.author.id);
            return (
              <div key={p.id} id={`yorum-${p.id}`} className="p-3 sm:p-4 scroll-mt-4">
                <p className="font-mono text-[12px] opacity-75">
                  <ForumAuthorName
                    link
                    username={p.author.username}
                    isFanOfWeek={p.author.isFanOfWeek}
                  />{" "}
                  • {formatForumDate(p.createdAt)}
                  {p.editedAt ? " • düzenlendi" : ""}
                </p>
                <p className="font-mono text-[15px] mt-1 whitespace-pre-wrap leading-[1.5]">{p.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LikeButton
                    type="post"
                    id={p.id}
                    count={p.likeCount ?? 0}
                    liked={Boolean(p.likedByMe)}
                    viewer={likeViewer(p.author.id)}
                    loginNext={`${topicPath}#yorum-${p.id}`}
                  />
                  {canWrite && !mine && <ReportButton type="post" id={p.id} />}
                  {canWrite && !mine && (
                    <BlockButton
                      userId={p.author.id}
                      username={p.author.username}
                      onBlocked={() => void load()}
                    />
                  )}
                  {mine && user?.verified && (
                    <span className="ml-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting({ kind: "post", id: p.id });
                        }}
                        className={btnSmDanger}
                      >
                        SİL
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pager page={page} pages={pages} onPage={setPage} />

      <div className="mt-5 border-[4px] border-black bg-[#FFFEFA] p-4">
        {locked ? (
          <p className="font-anton text-[18px]">BU KONU KİLİTLİ. YENİ YORUM YAZILAMAZ.</p>
        ) : banned ? (
          <p className="font-mono text-[14px]">{message || "Hesabın askıda. Yorum yazamazsın."}</p>
        ) : !user && !loading ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[14px]">Yorum yazmak için giriş yap.</p>
            <Link className={btnPrimary} href={`/giris?next=${encodeURIComponent(topicPath)}`}>
              GİRİŞ YAP
            </Link>
          </div>
        ) : user && !user.verified ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[14px]">Yorum yazmak için hesabını bir kez doğrula.</p>
            <Link href="/takim-sec" className={btnPrimary}>
              HESABINI DOĞRULA
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendReply();
            }}
          >
            <label className="block">
              <span className={labelClass}>YORUMUN</span>
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value.slice(0, FORUM_POST_MAX));
                  if (postError) setPostError(null);
                }}
                rows={4}
                aria-describedby="yorum-sayac"
                className={inputClass}
              />
            </label>
            <p id="yorum-sayac" className={`${hintClass} mt-1`}>
              {draft.length}/{FORUM_POST_MAX} karakter • Gönderdikten sonra düzenlenemez, silebilirsin.
            </p>
            {postError && (
              <p
                role="alert"
                className="mt-2 font-mono text-[13px] border-[2px] border-dashed border-black p-2 bg-[#C8102E]/10"
              >
                {postError}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !user}
              aria-busy={sending || undefined}
              className={`mt-2 ${btnPrimary}`}
            >
              {sending ? "GÖNDERİLİYOR…" : "YORUMU GÖNDER"}
            </button>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={deleting?.kind === "topic" ? "KONU SİLİNSİN Mİ?" : "YORUM SİLİNSİN Mİ?"}
        body={
          deleting?.kind === "topic"
            ? "Konu ve altındaki yorumlar tribünden kalkar. Bu işlem geri alınamaz."
            : "Yorumun tribünden kalkar. Bu işlem geri alınamaz."
        }
        confirmLabel="SİL"
        busyLabel="SİLİNİYOR…"
        busy={sending}
        error={deleteError}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting?.kind === "topic") void deleteTopic();
          else if (deletingPost != null) void deletePost(deletingPost);
        }}
      />
    </ForumShell>
  );
}

