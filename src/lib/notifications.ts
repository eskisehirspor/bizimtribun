import type Database from "better-sqlite3";
import { isBlockedBetween } from "./forum-social";

/**
 * In-site notifications. Never sent by SMS or e-mail. Nothing is created
 * for your own actions, and a block in either direction suppresses
 * notifications between the two members.
 */
export type NotificationKind = "reply" | "like" | "mention" | "moderation" | "badge" | "system";

export const NOTIFICATION_KEEP_DAYS = 90;
const MAX_MENTIONS_PER_POST = 5;

type Insert = {
  userId: number;
  kind: NotificationKind;
  actorId?: number | null;
  topicId?: number | null;
  postId?: number | null;
  body: string;
  dedupeKey?: string | null;
};

/** Member-controlled kinds; moderation, badge and system notices always arrive. */
const PREF_COLUMN: Partial<Record<NotificationKind, string>> = {
  reply: "notify_replies",
  mention: "notify_mentions",
  like: "notify_likes",
};

export function notify(db: Database.Database, n: Insert) {
  if (n.actorId != null) {
    if (n.actorId === n.userId) return false;
    if (isBlockedBetween(db, n.actorId, n.userId)) return false;
  }
  const pref = PREF_COLUMN[n.kind];
  if (pref) {
    const row = db.prepare(`SELECT ${pref} as on_ FROM users WHERE id = ?`).get(n.userId) as
      | { on_: number }
      | undefined;
    if (!row || !row.on_) return false;
  }
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO notifications (user_id, kind, actor_user_id, topic_id, post_id, body, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      n.userId,
      n.kind,
      n.actorId ?? null,
      n.topicId ?? null,
      n.postId ?? null,
      n.body.slice(0, 280),
      n.dedupeKey ?? null,
      new Date().toISOString(),
    );
  return res.changes === 1;
}

function username(db: Database.Database, id: number) {
  return (db.prepare(`SELECT username FROM users WHERE id = ?`).get(id) as { username: string } | undefined)
    ?.username;
}

export function notifyLike(
  db: Database.Database,
  input: { actorId: number; recipientId: number; type: "topic" | "post"; id: number },
) {
  const who = username(db, input.actorId) ?? "Bir üye";
  const topicId =
    input.type === "topic"
      ? input.id
      : ((db.prepare(`SELECT topic_id FROM forum_posts WHERE id = ?`).get(input.id) as { topic_id: number } | undefined)
          ?.topic_id ?? null);
  return notify(db, {
    userId: input.recipientId,
    kind: "like",
    actorId: input.actorId,
    topicId,
    postId: input.type === "post" ? input.id : null,
    body: `@${who} ${input.type === "topic" ? "konunu" : "yorumunu"} beğendi.`,
    // One notification per member per item, even after unlike/like again.
    dedupeKey: `like:${input.type}:${input.id}:${input.actorId}`,
  });
}

/** @kullaniciadi mentions in a reply, at most five per post. */
export function extractMentions(content: string) {
  const names = new Set<string>();
  for (const m of content.matchAll(/(?:^|[^\w@])@([a-zA-Z0-9_]{3,20})\b/g)) {
    names.add(m[1]!.toLowerCase());
    if (names.size >= MAX_MENTIONS_PER_POST) break;
  }
  return [...names];
}

export function notifyReply(
  db: Database.Database,
  input: { actorId: number; topicId: number; postId: number; content: string },
) {
  const topic = db
    .prepare(`SELECT user_id, title FROM forum_topics WHERE id = ?`)
    .get(input.topicId) as { user_id: number; title: string } | undefined;
  if (!topic) return;
  const who = username(db, input.actorId) ?? "Bir üye";
  notify(db, {
    userId: topic.user_id,
    kind: "reply",
    actorId: input.actorId,
    topicId: input.topicId,
    postId: input.postId,
    body: `@${who} "${topic.title.slice(0, 80)}" konuna yazdı.`,
  });
  for (const name of extractMentions(input.content)) {
    const target = db
      .prepare(`SELECT id FROM users WHERE username_norm = ? AND deleted_at IS NULL`)
      .get(name) as { id: number } | undefined;
    if (!target || target.id === topic.user_id) continue;
    notify(db, {
      userId: target.id,
      kind: "mention",
      actorId: input.actorId,
      topicId: input.topicId,
      postId: input.postId,
      body: `@${who} seni "${topic.title.slice(0, 80)}" konusunda andı.`,
      dedupeKey: `mention:${input.postId}:${target.id}`,
    });
  }
}

/** Tells the author when a moderator removes or holds their content. */
export function notifyModeration(
  db: Database.Database,
  input: { userId: number; topicId?: number | null; postId?: number | null; body: string },
) {
  return notify(db, { ...input, kind: "moderation" });
}

export function listNotifications(db: Database.Database, userId: number, limit = 30, before?: number) {
  const rows = db
    .prepare(
      `SELECT n.id, n.kind, n.topic_id as topicId, n.post_id as postId, n.body, n.read_at as readAt,
              n.created_at as createdAt, u.username as actor
       FROM notifications n LEFT JOIN users u ON u.id = n.actor_user_id
       WHERE n.user_id = ? ${before ? "AND n.id < ?" : ""}
       ORDER BY n.id DESC LIMIT ?`,
    )
    .all(...(before ? [userId, before, limit] : [userId, limit])) as Array<{
    id: number;
    kind: NotificationKind;
    topicId: number | null;
    postId: number | null;
    body: string;
    readAt: string | null;
    createdAt: string;
    actor: string | null;
  }>;
  return rows;
}

export function unreadCount(db: Database.Database, userId: number) {
  return (
    db
      .prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`)
      .get(userId) as { c: number }
  ).c;
}

export function markRead(db: Database.Database, userId: number, ids: number[] | "all") {
  const now = new Date().toISOString();
  if (ids === "all") {
    return db
      .prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`)
      .run(now, userId).changes;
  }
  const stmt = db.prepare(
    `UPDATE notifications SET read_at = ? WHERE user_id = ? AND id = ? AND read_at IS NULL`,
  );
  let n = 0;
  for (const id of ids.slice(0, 100)) n += stmt.run(now, userId, id).changes;
  return n;
}

/** Notifications older than the retention window are deleted, read or not. */
export function purgeOldNotifications(db: Database.Database, now = Date.now()) {
  const cutoff = new Date(now - NOTIFICATION_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return db.prepare(`DELETE FROM notifications WHERE created_at < ?`).run(cutoff).changes;
}
