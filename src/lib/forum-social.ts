import type { Db } from "./db";
import { writeAudit } from "./audit";
import { rateCount, rateNote } from "./auth-otp";
import { hmac } from "./crypto";
import { findLivePost, findLiveTopic, topicAccess, topicBoardOpen } from "./forum";
import { FORUM_REPORTS_TO_HOLD } from "./forum-spam";

/**
 * Likes, reports and member blocks. All writes come from a phone-verified,
 * non-banned account (checked by the route with requireForumWriter).
 */

const HOUR_MS = 60 * 60 * 1000;
export const LIKES_PER_USER_HOUR = 200;
export const REPORTS_PER_USER_HOUR = 20;
export const BLOCKS_PER_USER_HOUR = 30;

export const REPORT_REASONS = ["hakaret", "nefret", "spam", "kisisel_veri", "siddet", "diger"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  hakaret: "Hakaret / küfür",
  nefret: "Nefret söylemi / ayrımcılık",
  spam: "Spam / reklam",
  kisisel_veri: "Kişisel bilgi paylaşımı",
  siddet: "Şiddet / tehdit",
  diger: "Diğer",
};

type Fail = { ok: false; error: string; status: number };
type ContentType = "topic" | "post";

/**
 * The live, public topic or post a like/report points at, with its author.
 * Team-tribune content only resolves for members of that tribune (staff may
 * read and report there, but liking counts as taking part).
 */
async function liveTarget(db: Db, type: ContentType, id: number, userId: number, mode: "read" | "write") {
  const viewer = await db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(userId) as
    | { id: number; role: string | null }
    | undefined;
  if (type === "topic") {
    const topic = await findLiveTopic(id);
    if (!topic || !await topicBoardOpen(topic) || !(await topicAccess(topic, viewer, mode)).ok) return null;
    return { authorId: topic.user_id, topicId: topic.id };
  }
  const post = await findLivePost(id);
  if (!post) return null;
  const topic = await findLiveTopic(post.topic_id);
  if (!topic || !await topicBoardOpen(topic) || !(await topicAccess(topic, viewer, mode)).ok) return null;
  return { authorId: post.user_id, topicId: topic.id };
}

async function limited(db: Db, kind: string, userId: number, max: number) {
  const key = hmac(`${kind}:${userId}`);
  if (await rateCount(db, key, HOUR_MS) >= max) return true;
  await rateNote(db, key);
  return false;
}

export async function isBlockedBetween(db: Db, a: number, b: number) {
  return Boolean(
    await db
            .prepare(
              `SELECT 1 FROM user_blocks
         WHERE (blocker_user_id = ? AND blocked_user_id = ?) OR (blocker_user_id = ? AND blocked_user_id = ?)`,
            )
            .get(a, b, b, a),
  );
}

export async function setLike(
  db: Db,
  userId: number,
  type: ContentType,
  id: number,
  liked: boolean,
): Promise<{ ok: true; likeCount: number; likedByMe: boolean; authorId: number; created: boolean } | Fail> {
  const target = await liveTarget(db, type, id, userId, "write");
  if (!target) return { ok: false, error: "İçerik bulunamadı.", status: 404 };
  if (target.authorId === userId) {
    return { ok: false, error: "Kendi yazını beğenemezsin.", status: 400 };
  }
  let created = false;
  if (liked && await isBlockedBetween(db, userId, target.authorId)) {
    return { ok: false, error: "Bu üyeyle aranızda engel var.", status: 403 };
  }
  if (liked) {
    if (await limited(db, "forum-like", userId, LIKES_PER_USER_HOUR)) {
      return { ok: false, error: "Çok fazla beğeni. Biraz sonra dene.", status: 429 };
    }
    created =
      (await db
                .prepare(
                  `INSERT INTO forum_likes (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
                )
                .run(userId, type, id, new Date().toISOString())).changes === 1;
  } else {
    await db.prepare(`DELETE FROM forum_likes WHERE user_id = ? AND target_type = ? AND target_id = ?`).run(
            userId,
            type,
            id,
          );
  }
  const likeCount = (
    await db
            .prepare(`SELECT COUNT(*) as c FROM forum_likes WHERE target_type = ? AND target_id = ?`)
            .get(type, id) as { c: number }
  ).c;
  return { ok: true, likeCount, likedByMe: liked, authorId: target.authorId, created };
}

export async function fileReport(
  db: Db,
  reporterId: number,
  input: { type: ContentType | "user"; id: number; reason: ReportReason; note?: string | null },
): Promise<{ ok: true; id: number } | Fail> {
  if (input.type === "user") {
    const user = await db
          .prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`)
          .get(input.id) as { id: number } | undefined;
    if (!user) return { ok: false, error: "Üye bulunamadı.", status: 404 };
    if (user.id === reporterId) return { ok: false, error: "Kendini bildiremezsin.", status: 400 };
  } else {
    const target = await liveTarget(db, input.type, input.id, reporterId, "read");
    if (!target) return { ok: false, error: "İçerik bulunamadı.", status: 404 };
    if (target.authorId === reporterId) {
      return { ok: false, error: "Kendi yazını bildiremezsin.", status: 400 };
    }
  }
  if (await limited(db, "forum-report", reporterId, REPORTS_PER_USER_HOUR)) {
    return { ok: false, error: "Çok fazla bildirim. Biraz sonra dene.", status: 429 };
  }
  const note = input.note?.replace(/\s+/g, " ").trim().slice(0, 500) || null;
  const res = await db
      .prepare(
        `INSERT INTO forum_reports (reporter_user_id, target_type, target_id, reason, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      )
      .run(reporterId, input.type, input.id, input.reason, note, new Date().toISOString());
  if (res.changes !== 1) {
    return { ok: false, error: "Bunu zaten bildirdin; moderatörler inceleyecek.", status: 409 };
  }
  if (input.type !== "user") await holdWhenReportedEnough(db, input.type, input.id);
  return { ok: true, id: Number(res.lastInsertRowid) };
}

/**
 * Enough members reporting the same text hides it until a moderator looks,
 * unless a moderator already approved it. Staff texts are never auto-hidden.
 */
async function holdWhenReportedEnough(db: Db, type: ContentType, id: number) {
  const open = (
    await db
            .prepare(
              `SELECT COUNT(DISTINCT reporter_user_id) as c FROM forum_reports
         WHERE target_type = ? AND target_id = ? AND status = 'open'`,
            )
            .get(type, id) as { c: number }
  ).c;
  if (open < FORUM_REPORTS_TO_HOLD) return;
  const table = type === "topic" ? "forum_topics" : "forum_posts";
  const row = await db
      .prepare(
        `SELECT c.id, c.user_id, c.held_at, u.role ${type === "post" ? ", c.topic_id" : ""}
       FROM ${table} c JOIN users u ON u.id = c.user_id
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      )
      .get(id) as { id: number; user_id: number; held_at: string | null; role: string; topic_id?: number } | undefined;
  if (!row || row.held_at || row.role !== "user") return;
  const targetCol = type === "topic" ? "target_topic_id = ? AND target_post_id IS NULL" : "target_post_id = ?";
  const approved = await db
      .prepare(`SELECT 1 FROM moderation_actions WHERE action = 'approve_moderation' AND ${targetCol} LIMIT 1`)
      .get(id);
  if (approved) return;
  const now = new Date().toISOString();
  await db.prepare(`UPDATE ${table} SET held_at = ? WHERE id = ? AND held_at IS NULL`).run(now, id);
  await db.prepare(
        `INSERT INTO moderation_actions
     (moderator_user_id, target_user_id, target_topic_id, target_post_id, action, reason, created_at)
     VALUES (?, ?, ?, ?, 'auto_review', ?, ?)`,
      ).run(
        row.user_id,
        row.user_id,
        type === "topic" ? id : (row.topic_id ?? null),
        type === "post" ? id : null,
        `auto:review:reports:medium:reports.${open}`,
        now,
      );
}

export type ReportRow = {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  reporter: string | null;
  handledBy: string | null;
  handledAt: string | null;
  resolutionNote: string | null;
  /** Short preview of the reported content (or the username for a member report). */
  preview: string | null;
  topicId: number | null;
  authorId: number | null;
  authorUsername: string | null;
  sameTargetOpen: number;
};

export async function listReports(
  db: Db,
  opts: { status: "open" | "closed"; limit: number; offset: number },
) {
  const where = opts.status === "open" ? `r.status = 'open'` : `r.status != 'open'`;
  const rows = await db
      .prepare(
        `SELECT r.*, ru.username as reporter, hu.username as handler,
              (SELECT COUNT(*) FROM forum_reports r2
               WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id AND r2.status = 'open') as same_open
       FROM forum_reports r
       LEFT JOIN users ru ON ru.id = r.reporter_user_id
       LEFT JOIN users hu ON hu.id = r.handled_by_user_id
       WHERE ${where}
       ORDER BY r.id ${opts.status === "open" ? "ASC" : "DESC"}
       LIMIT ? OFFSET ?`,
      )
      .all(opts.limit, opts.offset) as Array<{
    id: number;
    target_type: string;
    target_id: number;
    reason: string;
    note: string | null;
    status: string;
    created_at: string;
    reporter: string | null;
    handler: string | null;
    handled_at: string | null;
    resolution_note: string | null;
    same_open: number;
  }>;
  const total = (await db.prepare(`SELECT COUNT(*) as c FROM forum_reports r WHERE ${where}`).get() as { c: number })
    .c;

  const items: ReportRow[] = await Promise.all(rows.map(async (r) => {
    let preview: string | null = null;
    let topicId: number | null = null;
    let authorId: number | null = null;
    let authorUsername: string | null = null;
    if (r.target_type === "topic") {
      const t = await db
              .prepare(
                `SELECT t.id, t.title, t.user_id, u.username FROM forum_topics t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
              )
              .get(r.target_id) as { id: number; title: string; user_id: number; username: string } | undefined;
      preview = t?.title ?? null;
      topicId = t?.id ?? null;
      authorId = t?.user_id ?? null;
      authorUsername = t?.username ?? null;
    } else if (r.target_type === "post") {
      const p = await db
              .prepare(
                `SELECT p.topic_id, p.content, p.user_id, u.username FROM forum_posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
              )
              .get(r.target_id) as { topic_id: number; content: string; user_id: number; username: string } | undefined;
      preview = p ? p.content.slice(0, 280) : null;
      topicId = p?.topic_id ?? null;
      authorId = p?.user_id ?? null;
      authorUsername = p?.username ?? null;
    } else {
      const u = await db.prepare(`SELECT id, username FROM users WHERE id = ?`).get(r.target_id) as
        | { id: number; username: string }
        | undefined;
      preview = u ? `@${u.username}` : null;
      authorId = u?.id ?? null;
      authorUsername = u?.username ?? null;
    }
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
      reporter: r.reporter,
      handledBy: r.handler,
      handledAt: r.handled_at,
      resolutionNote: r.resolution_note,
      preview,
      topicId,
      authorId,
      authorUsername,
      sameTargetOpen: r.same_open,
    };
  }));
  return { total, items };
}

/**
 * Closes every open report on the same target at once, so a post reported by
 * ten people is handled once. Removing the content itself is done with the
 * existing moderation actions, which are audited on their own.
 */
export async function closeReport(
  db: Db,
  moderatorId: number,
  reportId: number,
  outcome: "resolved" | "dismissed",
  note: string,
): Promise<{ ok: true; closed: number } | Fail> {
  return db.transaction(async () => {
    const r = await db.prepare(`SELECT * FROM forum_reports WHERE id = ?`).get(reportId) as
      | { id: number; target_type: string; target_id: number; status: string }
      | undefined;
    if (!r) return { ok: false as const, error: "Bildirim bulunamadı.", status: 404 };
    if (r.status !== "open") return { ok: false as const, error: "Bildirim zaten kapalı.", status: 409 };
    const now = new Date().toISOString();
    const res = await db
          .prepare(
            `UPDATE forum_reports SET status = ?, handled_by_user_id = ?, handled_at = ?, resolution_note = ?
         WHERE target_type = ? AND target_id = ? AND status = 'open'`,
          )
          .run(outcome, moderatorId, now, note.slice(0, 500), r.target_type, r.target_id);
    await writeAudit(db, {
            actorUserId: moderatorId,
            action: outcome === "resolved" ? "report_resolve" : "report_dismiss",
            targetType: r.target_type,
            targetId: r.target_id,
            reason: note,
            meta: { reports: res.changes },
          });
    return { ok: true as const, closed: res.changes };
  })();
}

export async function blockUser(
  db: Db,
  blockerId: number,
  blockedId: number,
  block: boolean,
): Promise<{ ok: true } | Fail> {
  if (blockerId === blockedId) return { ok: false, error: "Kendini engelleyemezsin.", status: 400 };
  const target = await db
      .prepare(`SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL`)
      .get(blockedId) as { id: number; role: string } | undefined;
  if (!target) return { ok: false, error: "Üye bulunamadı.", status: 404 };
  if (block) {
    if (target.role !== "user") {
      return { ok: false, error: "Moderatör ve yöneticiler engellenemez.", status: 400 };
    }
    if (await limited(db, "user-block", blockerId, BLOCKS_PER_USER_HOUR)) {
      return { ok: false, error: "Çok fazla işlem. Biraz sonra dene.", status: 429 };
    }
    await db.prepare(
            `INSERT INTO user_blocks (blocker_user_id, blocked_user_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
          ).run(blockerId, blockedId, new Date().toISOString());
  } else {
    await db.prepare(`DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?`).run(
            blockerId,
            blockedId,
          );
  }
  return { ok: true };
}

export async function listBlocks(db: Db, blockerId: number) {
  return await db
      .prepare(
        `SELECT u.id, u.username, b.created_at as createdAt
       FROM user_blocks b JOIN users u ON u.id = b.blocked_user_id
       WHERE b.blocker_user_id = ? ORDER BY b.created_at DESC`,
      )
      .all(blockerId) as { id: number; username: string; createdAt: string }[];
}
