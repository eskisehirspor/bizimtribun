import type Database from "better-sqlite3";

export const HELD_KINDS = ["topic", "post"] as const;
export type HeldKind = (typeof HELD_KINDS)[number];

export function parseHeldKind(raw: string | undefined | null): HeldKind | null {
  if (raw === "topic" || raw === "post") return raw;
  return null;
}

export function parseHeldId(raw: string | undefined | null) {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

export function heldModerationAdminGate(user: { role?: string } | null | undefined) {
  if (!user) return { ok: false as const, error: "Giriş gerekli.", status: 401 };
  if (user.role !== "admin") {
    return { ok: false as const, error: "Bu işlem için yetkin yok.", status: 403 };
  }
  return { ok: true as const };
}

export function parseAutoReviewMeta(reason: string | null | undefined) {
  const empty = {
    category: null as string | null,
    severity: null as string | null,
    ruleId: null as string | null,
    autoReason: reason ?? null,
  };
  if (!reason) return empty;
  const parts = reason.split(":");
  if (parts[0] !== "auto" || parts.length < 4) return empty;
  const categories = parts[2] || "";
  const category = categories.split(",")[0] || null;
  const severity = parts[3] || null;
  const ruleId = parts.slice(4).join(":") || null;
  return { category, severity, ruleId, autoReason: reason };
}

function nowIso() {
  return new Date().toISOString();
}

function writeAudit(
  db: Database.Database,
  input: {
    moderatorUserId: number;
    action: string;
    reason?: string | null;
    targetUserId?: number | null;
    targetTopicId?: number | null;
    targetPostId?: number | null;
  },
) {
  db.prepare(
    `INSERT INTO moderation_actions
     (moderator_user_id, target_user_id, target_topic_id, target_post_id, action, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.moderatorUserId,
    input.targetUserId ?? null,
    input.targetTopicId ?? null,
    input.targetPostId ?? null,
    input.action,
    input.reason?.trim().slice(0, 500) || null,
    nowIso(),
  );
}

export function latestAutoReview(
  db: Database.Database,
  kind: HeldKind,
  id: number,
) {
  const row =
    kind === "topic"
      ? (db
          .prepare(
            `SELECT id, reason FROM moderation_actions
             WHERE action = 'auto_review' AND target_topic_id = ? AND target_post_id IS NULL
             ORDER BY id DESC LIMIT 1`,
          )
          .get(id) as { id: number; reason: string | null } | undefined)
      : (db
          .prepare(
            `SELECT id, reason FROM moderation_actions
             WHERE action = 'auto_review' AND target_post_id = ?
             ORDER BY id DESC LIMIT 1`,
          )
          .get(id) as { id: number; reason: string | null } | undefined);
  return row ?? null;
}

function withAutoReviewTag(reason: string | null, autoReviewId: number | null) {
  const base = reason?.trim() || "";
  if (!autoReviewId) return base || null;
  const tag = `auto_review:${autoReviewId}`;
  if (!base) return tag;
  return `${base} [${tag}]`.slice(0, 500);
}

export type HeldTarget = {
  kind: HeldKind;
  id: number;
  userId: number;
  topicId: number;
  postId: number | null;
  authorRole: string;
};

export function loadHeldTarget(
  db: Database.Database,
  kind: HeldKind,
  id: number,
):
  | { ok: true; target: HeldTarget }
  | { ok: false; error: string; status: number } {
  if (kind === "topic") {
    const row = db
      .prepare(
        `SELECT t.id, t.user_id, t.held_at, t.deleted_at, u.role
         FROM forum_topics t
         JOIN users u ON u.id = t.user_id
         WHERE t.id = ?`,
      )
      .get(id) as
      | {
          id: number;
          user_id: number;
          held_at: string | null;
          deleted_at: string | null;
          role: string;
        }
      | undefined;
    if (!row) return { ok: false, error: "İçerik bulunamadı.", status: 404 };
    if (row.deleted_at) {
      return { ok: false, error: "Bu içerik zaten sonuçlanmış.", status: 409 };
    }
    if (!row.held_at) {
      return { ok: false, error: "Bu içerik beklemede değil.", status: 409 };
    }
    return {
      ok: true,
      target: {
        kind,
        id: row.id,
        userId: row.user_id,
        topicId: row.id,
        postId: null,
        authorRole: row.role,
      },
    };
  }

  const row = db
    .prepare(
      `SELECT p.id, p.user_id, p.topic_id, p.held_at, p.deleted_at, u.role
       FROM forum_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        user_id: number;
        topic_id: number;
        held_at: string | null;
        deleted_at: string | null;
        role: string;
      }
    | undefined;
  if (!row) return { ok: false, error: "İçerik bulunamadı.", status: 404 };
  if (row.deleted_at) {
    return { ok: false, error: "Bu içerik zaten sonuçlanmış.", status: 409 };
  }
  if (!row.held_at) {
    return { ok: false, error: "Bu içerik beklemede değil.", status: 409 };
  }
  return {
    ok: true,
    target: {
      kind,
      id: row.id,
      userId: row.user_id,
      topicId: row.topic_id,
      postId: row.id,
      authorRole: row.role,
    },
  };
}

export function countHeldItems(db: Database.Database) {
  const topics = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM forum_topics
         WHERE held_at IS NOT NULL AND deleted_at IS NULL`,
      )
      .get() as { c: number }
  ).c;
  const posts = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM forum_posts
         WHERE held_at IS NOT NULL AND deleted_at IS NULL`,
      )
      .get() as { c: number }
  ).c;
  return topics + posts;
}

export function listHeldItems(db: Database.Database, offset: number, limit: number) {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT 'topic' as kind, t.id as id, t.team_id as teamId, tm.name as teamName,
                t.title as title, t.content as content, t.held_at as heldAt,
                t.user_id as userId, u.username as username, t.id as topicId
         FROM forum_topics t
         JOIN users u ON u.id = t.user_id
         JOIN teams tm ON tm.id = t.team_id
         WHERE t.held_at IS NOT NULL AND t.deleted_at IS NULL
         UNION ALL
         SELECT 'post' as kind, p.id as id, t.team_id as teamId, tm.name as teamName,
                t.title as title, p.content as content, p.held_at as heldAt,
                p.user_id as userId, u.username as username, p.topic_id as topicId
         FROM forum_posts p
         JOIN forum_topics t ON t.id = p.topic_id
         JOIN users u ON u.id = p.user_id
         JOIN teams tm ON tm.id = t.team_id
         WHERE p.held_at IS NOT NULL AND p.deleted_at IS NULL
       )
       ORDER BY heldAt ASC, kind ASC, id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Array<{
    kind: HeldKind;
    id: number;
    teamId: string;
    teamName: string;
    title: string;
    content: string;
    heldAt: string;
    userId: number;
    username: string;
    topicId: number;
  }>;

  return {
    total: countHeldItems(db),
    items: rows.map((row) => {
      const auto = latestAutoReview(db, row.kind, row.id);
      const meta = parseAutoReviewMeta(auto?.reason ?? null);
      return {
        kind: row.kind,
        id: row.id,
        teamId: row.teamId,
        teamName: row.teamName,
        title: row.title,
        content: row.content,
        heldAt: row.heldAt,
        username: row.username,
        userId: row.userId,
        topicId: row.topicId,
        autoReviewId: auto?.id ?? null,
        category: meta.category,
        severity: meta.severity,
        ruleId: meta.ruleId,
        autoReason: meta.autoReason,
      };
    }),
  };
}

export function approveHeldContent(
  db: Database.Database,
  kind: HeldKind,
  id: number,
  moderatorUserId: number,
  reason: string | null,
) {
  const loaded = loadHeldTarget(db, kind, id);
  if (!loaded.ok) return loaded;
  const { target } = loaded;
  const auto = latestAutoReview(db, kind, id);
  const tagged = withAutoReviewTag(reason, auto?.id ?? null);
  const now = nowIso();

  const run = db.transaction(() => {
    const sql =
      kind === "topic"
        ? `UPDATE forum_topics
           SET held_at = NULL, updated_at = ?
           WHERE id = ? AND held_at IS NOT NULL AND deleted_at IS NULL`
        : `UPDATE forum_posts
           SET held_at = NULL, updated_at = ?
           WHERE id = ? AND held_at IS NOT NULL AND deleted_at IS NULL`;
    const info = db.prepare(sql).run(now, id);
    if (info.changes !== 1) {
      return { ok: false as const, error: "Bu içerik beklemede değil.", status: 409 };
    }
    writeAudit(db, {
      moderatorUserId,
      action: "approve_moderation",
      reason: tagged,
      targetUserId: target.userId,
      targetTopicId: target.topicId,
      targetPostId: target.postId,
    });
    return { ok: true as const };
  });
  return run();
}

function applyRejectHeld(
  db: Database.Database,
  target: HeldTarget,
  moderatorUserId: number,
  taggedReason: string,
) {
  const now = nowIso();
  const sql =
    target.kind === "topic"
      ? `UPDATE forum_topics
         SET deleted_at = ?, held_at = NULL, updated_at = ?
         WHERE id = ? AND held_at IS NOT NULL AND deleted_at IS NULL`
      : `UPDATE forum_posts
         SET deleted_at = ?, held_at = NULL, updated_at = ?
         WHERE id = ? AND held_at IS NOT NULL AND deleted_at IS NULL`;
  const info = db.prepare(sql).run(now, now, target.id);
  if (info.changes !== 1) {
    return { ok: false as const, error: "Bu içerik beklemede değil.", status: 409 };
  }
  writeAudit(db, {
    moderatorUserId,
    action: "reject_moderation",
    reason: taggedReason,
    targetUserId: target.userId,
    targetTopicId: target.topicId,
    targetPostId: target.postId,
  });
  return { ok: true as const };
}

export function rejectHeldContent(
  db: Database.Database,
  kind: HeldKind,
  id: number,
  moderatorUserId: number,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false as const, error: "Gerekçe zorunlu.", status: 400 };
  }
  const loaded = loadHeldTarget(db, kind, id);
  if (!loaded.ok) return loaded;
  const auto = latestAutoReview(db, kind, id);
  const tagged = withAutoReviewTag(trimmed, auto?.id ?? null) || trimmed;
  return db.transaction(() =>
    applyRejectHeld(db, loaded.target, moderatorUserId, tagged),
  )();
}

export function banHeldAuthor(
  db: Database.Database,
  kind: HeldKind,
  id: number,
  moderatorUserId: number,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false as const, error: "Gerekçe zorunlu.", status: 400 };
  }
  const loaded = loadHeldTarget(db, kind, id);
  if (!loaded.ok) return loaded;
  if (loaded.target.authorRole === "admin") {
    return { ok: false, error: "Admin hesap banlanamaz.", status: 409 };
  }

  const auto = latestAutoReview(db, kind, id);
  const tagged = withAutoReviewTag(trimmed, auto?.id ?? null) || trimmed;

  const run = db.transaction(() => {
    const rejected = applyRejectHeld(db, loaded.target, moderatorUserId, tagged);
    if (!rejected.ok) return rejected;

    const now = nowIso();
    const banned = db
      .prepare(
        `UPDATE users
         SET status = 'banned', banned_at = ?, ban_reason = ?, ban_expires_at = NULL, updated_at = ?
         WHERE id = ? AND role != 'admin'`,
      )
      .run(now, trimmed.slice(0, 200), now, loaded.target.userId);
    if (banned.changes !== 1) {
      throw new Error("Admin hesap banlanamaz.");
    }
    db.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    ).run(now, loaded.target.userId);
    writeAudit(db, {
      moderatorUserId,
      action: "ban_user",
      reason: trimmed,
      targetUserId: loaded.target.userId,
      targetTopicId: loaded.target.topicId,
      targetPostId: loaded.target.postId,
    });
    return { ok: true as const };
  });
  try {
    return run();
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Ban başarısız.",
      status: 409,
    };
  }
}

export function isPublicForumSqlRow(row: {
  deleted_at: string | null;
  held_at: string | null;
}) {
  return !row.deleted_at && !row.held_at;
}
