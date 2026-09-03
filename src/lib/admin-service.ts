import { getDb } from "./db";
import {
  adminSoftDeletePost,
  adminSoftDeleteTopic,
  findPost,
  findTopic,
  setTopicLocked,
} from "./forum";
import { recordModerationAction } from "./moderation";
import {
  approveHeldContent,
  countHeldItems,
  listHeldItems,
  loadHeldTarget,
  rejectHeldContent,
  type HeldKind,
} from "./moderation/held";
import { liveVotesWhere } from "./votes";
import {
  banUser,
  findUserById,
  isUserBanned,
  setUserRole,
  unbanUser,
  type UserRole,
  type UserRow,
} from "./users";

const nowIso = () => new Date().toISOString();

function bannedClause(alias: string) {
  return `(${alias}.status = 'banned' OR ${alias}.banned_at IS NOT NULL)
    AND (${alias}.ban_expires_at IS NULL OR ${alias}.ban_expires_at > ?)`;
}

export function getDashboardStats() {
  const db = getDb();
  const now = nowIso();
  const totalMembers = (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number }).c;
  const activeMembers = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM users u
         WHERE NOT (${bannedClause("u")})`,
      )
      .get(now) as { c: number }
  ).c;
  const totalTopics = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM forum_topics
         WHERE deleted_at IS NULL AND held_at IS NULL`,
      )
      .get() as { c: number }
  ).c;
  const totalPosts = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM forum_posts
         WHERE deleted_at IS NULL AND held_at IS NULL`,
      )
      .get() as { c: number }
  ).c;
  const activeBans = (
    db
      .prepare(`SELECT COUNT(*) as c FROM users u WHERE ${bannedClause("u")}`)
      .get(now) as { c: number }
  ).c;
  const activeForumTeams = (
    db
      .prepare(`SELECT COUNT(*) as c FROM teams WHERE is_forum_active = 1`)
      .get() as { c: number }
  ).c;

  const live = liveVotesWhere();
  const validVotes = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM votes v
         JOIN participants p ON p.id = v.participant_id
         WHERE ${live.sql}`,
      )
      .get(...live.params) as { c: number }
  ).c;

  const recent = db
    .prepare(
      `SELECT ma.id, ma.action, ma.reason, ma.created_at,
              ma.target_user_id, ma.target_topic_id, ma.target_post_id,
              m.username as moderator_username,
              t.username as target_username
       FROM moderation_actions ma
       JOIN users m ON m.id = ma.moderator_user_id
       LEFT JOIN users t ON t.id = ma.target_user_id
       ORDER BY ma.id DESC
       LIMIT 15`,
    )
    .all() as Array<{
    id: number;
    action: string;
    reason: string | null;
    created_at: string;
    target_user_id: number | null;
    target_topic_id: number | null;
    target_post_id: number | null;
    moderator_username: string;
    target_username: string | null;
  }>;

  return {
    totalMembers,
    activeMembers,
    totalTopics,
    totalPosts,
    activeBans,
    activeForumTeams,
    validVotes,
    recent: recent.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      createdAt: row.created_at,
      moderatorUsername: row.moderator_username,
      targetUserId: row.target_user_id,
      targetUsername: row.target_username,
      targetTopicId: row.target_topic_id,
      targetPostId: row.target_post_id,
    })),
  };
}

export type UserListFilters = {
  q: string | null;
  role: "user" | "admin" | null;
  banned: boolean | null;
  teamId: string | null;
  offset: number;
  limit: number;
};

export function listAdminUsers(filters: UserListFilters) {
  const db = getDb();
  const now = nowIso();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.q) {
    where.push(
      `(u.username_norm LIKE ? OR u.email_norm LIKE ? OR u.display_name LIKE ?
        OR IFNULL(u.first_name,'') LIKE ? OR IFNULL(u.last_name,'') LIKE ?
        OR IFNULL(u.phone,'') LIKE ? OR IFNULL(u.phone_norm,'') LIKE ?)`,
    );
    params.push(
      filters.q,
      filters.q,
      filters.q,
      filters.q,
      filters.q,
      filters.q,
      filters.q,
    );
  }
  if (filters.role) {
    where.push(`u.role = ?`);
    params.push(filters.role);
  }
  if (filters.teamId) {
    where.push(`u.team_id = ?`);
    params.push(filters.teamId);
  }
  if (filters.banned === true) {
    where.push(bannedClause("u"));
    params.push(now);
  } else if (filters.banned === false) {
    where.push(`NOT (${bannedClause("u")})`);
    params.push(now);
  }

  const whereSql = where.join(" AND ");
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${whereSql}`).get(...params) as {
      c: number;
    }
  ).c;

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.team_id, u.status, u.role,
              u.created_at, u.last_login_at, u.banned_at, u.ban_reason, u.ban_expires_at,
              tm.name as team_name
       FROM users u
       LEFT JOIN teams tm ON tm.id = u.team_id
       WHERE ${whereSql}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Array<{
    id: number;
    username: string;
    display_name: string;
    team_id: string | null;
    status: string;
    role: UserRole;
    created_at: string;
    last_login_at: string | null;
    banned_at: string | null;
    ban_reason: string | null;
    ban_expires_at: string | null;
    team_name: string | null;
  }>;

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      teamId: row.team_id,
      teamName: row.team_name,
      status: row.status,
      role: row.role === "admin" ? "admin" : "user",
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      banned: isUserBanned(row),
      bannedAt: row.banned_at,
      banExpiresAt: row.ban_expires_at,
    })),
  };
}

export function listAdminTeamOptions() {
  return getDb()
    .prepare(
      `SELECT id, name FROM teams WHERE id IN (SELECT DISTINCT team_id FROM users WHERE team_id IS NOT NULL)
       UNION
       SELECT id, name FROM teams WHERE is_forum_active = 1
       ORDER BY name`,
    )
    .all() as Array<{ id: string; name: string }>;
}

export function getAdminUserDetail(id: number) {
  const user = findUserById(id);
  if (!user) return null;
  const team = user.team_id
    ? (getDb()
        .prepare(`SELECT id, name FROM teams WHERE id = ?`)
        .get(user.team_id) as { id: string; name: string } | undefined)
    : undefined;

  const topics = getDb()
    .prepare(
      `SELECT id, team_id, title, created_at, locked_at, deleted_at, held_at
       FROM forum_topics WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
    )
    .all(id) as Array<{
    id: number;
    team_id: string;
    title: string;
    created_at: string;
    locked_at: string | null;
    deleted_at: string | null;
    held_at: string | null;
  }>;

  const posts = getDb()
    .prepare(
      `SELECT p.id, p.topic_id, p.content, p.created_at, p.deleted_at, p.held_at, t.title as topic_title, t.team_id
       FROM forum_posts p
       JOIN forum_topics t ON t.id = p.topic_id
       WHERE p.user_id = ?
       ORDER BY p.id DESC
       LIMIT 20`,
    )
    .all(id) as Array<{
    id: number;
    topic_id: number;
    content: string;
    created_at: string;
    deleted_at: string | null;
    held_at: string | null;
    topic_title: string;
    team_id: string;
  }>;

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    phone: user.phone,
    firstName: user.first_name,
    lastName: user.last_name,
    birthDate: user.birth_date,
    city: user.city,
    teamId: user.team_id,
    teamName: team?.name ?? null,
    status: user.status,
    role: user.role === "admin" ? "admin" : "user",
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    banned: isUserBanned(user),
    bannedAt: user.banned_at,
    banReason: user.ban_reason,
    banExpiresAt: user.ban_expires_at,
    topics: topics.map((t) => ({
      id: t.id,
      teamId: t.team_id,
      title: t.title,
      createdAt: t.created_at,
      locked: Boolean(t.locked_at),
      deleted: Boolean(t.deleted_at),
      held: Boolean(t.held_at),
    })),
    posts: posts.map((p) => ({
      id: p.id,
      topicId: p.topic_id,
      topicTitle: p.topic_title,
      teamId: p.team_id,
      content: p.content.slice(0, 280),
      createdAt: p.created_at,
      deleted: Boolean(p.deleted_at),
      held: Boolean(p.held_at),
    })),
  };
}

export function adminBanUser(
  targetId: number,
  reason: string,
  expiresAt: string | null,
  moderator: UserRow,
) {
  const db = getDb();
  return db.transaction(() => banUser(targetId, reason, expiresAt, moderator.id))();
}

export function adminUnbanUser(targetId: number, reason: string, moderator: UserRow) {
  const db = getDb();
  return db.transaction(() => unbanUser(targetId, reason, moderator.id))();
}

export function adminSetRole(
  targetId: number,
  role: UserRole,
  reason: string,
  moderator: UserRow,
) {
  const db = getDb();
  return db.transaction(() => setUserRole(targetId, role, moderator, reason))();
}

export type TopicListFilters = {
  q: string | null;
  teamId: string | null;
  deleted: "all" | "live" | "deleted";
  offset: number;
  limit: number;
};

export function listAdminTopics(filters: TopicListFilters) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.teamId) {
    where.push(`t.team_id = ?`);
    params.push(filters.teamId);
  }
  if (filters.q) {
    where.push(`t.title LIKE ?`);
    params.push(filters.q);
  }
  if (filters.deleted === "live") {
    where.push(`t.deleted_at IS NULL AND t.held_at IS NULL`);
  }
  if (filters.deleted === "deleted") where.push(`t.deleted_at IS NOT NULL`);

  const whereSql = where.join(" AND ");
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM forum_topics t WHERE ${whereSql}`).get(...params) as {
      c: number;
    }
  ).c;

  const rows = db
    .prepare(
      `SELECT t.id, t.team_id, t.title, t.created_at, t.locked_at, t.deleted_at, t.held_at, t.user_id,
              u.username,
              tm.name as team_name,
              (SELECT COUNT(*) FROM forum_posts p WHERE p.topic_id = t.id AND p.deleted_at IS NULL) as post_count
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN teams tm ON tm.id = t.team_id
       WHERE ${whereSql}
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Array<{
    id: number;
    team_id: string;
    title: string;
    created_at: string;
    locked_at: string | null;
    deleted_at: string | null;
    held_at: string | null;
    user_id: number;
    username: string;
    team_name: string | null;
    post_count: number;
  }>;

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      title: row.title,
      createdAt: row.created_at,
      locked: Boolean(row.locked_at),
      deleted: Boolean(row.deleted_at),
      held: Boolean(row.held_at),
      postCount: row.post_count,
      author: { id: row.user_id, username: row.username },
    })),
  };
}

export type PostListFilters = {
  q: string | null;
  teamId: string | null;
  topicId: number | null;
  deleted: "all" | "live" | "deleted";
  offset: number;
  limit: number;
};

export function listAdminPosts(filters: PostListFilters) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.teamId) {
    where.push(`t.team_id = ?`);
    params.push(filters.teamId);
  }
  if (filters.topicId) {
    where.push(`p.topic_id = ?`);
    params.push(filters.topicId);
  }
  if (filters.q) {
    where.push(`p.content LIKE ?`);
    params.push(filters.q);
  }
  if (filters.deleted === "live") {
    where.push(`p.deleted_at IS NULL AND p.held_at IS NULL`);
  }
  if (filters.deleted === "deleted") where.push(`p.deleted_at IS NOT NULL`);

  const whereSql = where.join(" AND ");
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM forum_posts p
         JOIN forum_topics t ON t.id = p.topic_id
         WHERE ${whereSql}`,
      )
      .get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT p.id, p.topic_id, p.content, p.created_at, p.deleted_at, p.held_at, p.user_id,
              u.username, t.title as topic_title, t.team_id, tm.name as team_name
       FROM forum_posts p
       JOIN forum_topics t ON t.id = p.topic_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN teams tm ON tm.id = t.team_id
       WHERE ${whereSql}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Array<{
    id: number;
    topic_id: number;
    content: string;
    created_at: string;
    deleted_at: string | null;
    held_at: string | null;
    user_id: number;
    username: string;
    topic_title: string;
    team_id: string;
    team_name: string | null;
  }>;

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      topicId: row.topic_id,
      topicTitle: row.topic_title,
      teamId: row.team_id,
      teamName: row.team_name,
      content: row.content.slice(0, 400),
      createdAt: row.created_at,
      deleted: Boolean(row.deleted_at),
      held: Boolean(row.held_at),
      author: { id: row.user_id, username: row.username },
    })),
  };
}

export function lockTopicAdmin(topicId: number, lock: boolean, reason: string, moderator: UserRow) {
  const topic = findTopic(topicId);
  if (!topic) return { ok: false as const, error: "Konu bulunamadı.", status: 404 };
  if (topic.deleted_at) return { ok: false as const, error: "Silinmiş konu kilitlenemez.", status: 409 };

  if (lock && topic.locked_at) return { ok: true as const };
  if (!lock && !topic.locked_at) return { ok: true as const };

  const db = getDb();
  db.transaction(() => {
    setTopicLocked(topicId, lock);
    recordModerationAction({
      moderatorUserId: moderator.id,
      targetTopicId: topicId,
      targetUserId: topic.user_id,
      action: lock ? "lock_topic" : "unlock_topic",
      reason,
    });
  })();
  return { ok: true as const };
}

export function deleteTopicAdmin(topicId: number, reason: string, moderator: UserRow) {
  const topic = findTopic(topicId);
  if (!topic) return { ok: false as const, error: "Konu bulunamadı.", status: 404 };
  if (topic.deleted_at) return { ok: false as const, error: "Konu zaten silinmiş.", status: 409 };

  const db = getDb();
  const ok = db.transaction(() => {
    const deleted = adminSoftDeleteTopic(topicId);
    if (!deleted) return false;
    recordModerationAction({
      moderatorUserId: moderator.id,
      targetTopicId: topicId,
      targetUserId: topic.user_id,
      action: "delete_topic",
      reason,
    });
    return true;
  })();
  if (!ok) return { ok: false as const, error: "Konu silinemedi.", status: 409 };
  return { ok: true as const };
}

export function deletePostAdmin(postId: number, reason: string, moderator: UserRow) {
  const post = findPost(postId);
  if (!post) return { ok: false as const, error: "Mesaj bulunamadı.", status: 404 };
  if (post.deleted_at) return { ok: false as const, error: "Mesaj zaten silinmiş.", status: 409 };

  const db = getDb();
  const ok = db.transaction(() => {
    const deleted = adminSoftDeletePost(postId);
    if (!deleted) return false;
    recordModerationAction({
      moderatorUserId: moderator.id,
      targetPostId: postId,
      targetTopicId: post.topic_id,
      targetUserId: post.user_id,
      action: "delete_post",
      reason,
    });
    return true;
  })();
  if (!ok) return { ok: false as const, error: "Mesaj silinemedi.", status: 409 };
  return { ok: true as const };
}

export type ModerationFilters = {
  action: string | null;
  moderatorId: number | null;
  moderatorQ: string | null;
  targetUserId: number | null;
  from: string | null;
  to: string | null;
  offset: number;
  limit: number;
};

export function listModeration(filters: ModerationFilters) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.action) {
    where.push(`ma.action = ?`);
    params.push(filters.action);
  }
  if (filters.moderatorId) {
    where.push(`ma.moderator_user_id = ?`);
    params.push(filters.moderatorId);
  }
  if (filters.moderatorQ) {
    where.push(`m.username LIKE ?`);
    params.push(filters.moderatorQ);
  }
  if (filters.targetUserId) {
    where.push(`ma.target_user_id = ?`);
    params.push(filters.targetUserId);
  }
  if (filters.from) {
    where.push(`ma.created_at >= ?`);
    params.push(filters.from);
  }
  if (filters.to) {
    where.push(`ma.created_at <= ?`);
    params.push(filters.to);
  }

  const whereSql = where.join(" AND ");
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM moderation_actions ma
         JOIN users m ON m.id = ma.moderator_user_id
         WHERE ${whereSql}`,
      )
      .get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT ma.id, ma.action, ma.reason, ma.created_at,
              ma.moderator_user_id, ma.target_user_id, ma.target_topic_id, ma.target_post_id,
              m.username as moderator_username,
              t.username as target_username
       FROM moderation_actions ma
       JOIN users m ON m.id = ma.moderator_user_id
       LEFT JOIN users t ON t.id = ma.target_user_id
       WHERE ${whereSql}
       ORDER BY ma.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Array<{
    id: number;
    action: string;
    reason: string | null;
    created_at: string;
    moderator_user_id: number;
    target_user_id: number | null;
    target_topic_id: number | null;
    target_post_id: number | null;
    moderator_username: string;
    target_username: string | null;
  }>;

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      createdAt: row.created_at,
      moderator: { id: row.moderator_user_id, username: row.moderator_username },
      targetUser: row.target_user_id
        ? { id: row.target_user_id, username: row.target_username }
        : null,
      targetTopicId: row.target_topic_id,
      targetPostId: row.target_post_id,
    })),
  };
}

export type BanListFilters = {
  state: "active" | "all";
  offset: number;
  limit: number;
};

export function listBans(filters: BanListFilters) {
  const db = getDb();
  const now = nowIso();

  if (filters.state === "active") {
    const where = bannedClause("u");
    const total = (
      db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${where}`).get(now) as { c: number }
    ).c;
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.banned_at, u.ban_reason, u.ban_expires_at, u.status,
                (SELECT m.username FROM moderation_actions ma
                 JOIN users m ON m.id = ma.moderator_user_id
                 WHERE ma.target_user_id = u.id AND ma.action = 'ban_user'
                 ORDER BY ma.id DESC LIMIT 1) as banned_by
         FROM users u
         WHERE ${where}
         ORDER BY u.banned_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(now, filters.limit, filters.offset) as Array<{
      id: number;
      username: string;
      banned_at: string | null;
      ban_reason: string | null;
      ban_expires_at: string | null;
      status: string;
      banned_by: string | null;
    }>;
    return {
      total,
      items: rows.map((row) => ({
        userId: row.id,
        username: row.username,
        reason: row.ban_reason,
        bannedAt: row.banned_at,
        expiresAt: row.ban_expires_at,
        permanent: !row.ban_expires_at,
        lifted: false,
        bannedBy: row.banned_by,
      })),
    };
  }

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM moderation_actions
         WHERE action IN ('ban_user','unban_user')`,
      )
      .get() as { c: number }
  ).c;
  const rows = db
    .prepare(
      `SELECT ma.id, ma.action, ma.reason, ma.created_at, ma.target_user_id,
              m.username as moderator_username,
              u.username as target_username,
              u.banned_at, u.ban_expires_at, u.status
       FROM moderation_actions ma
       JOIN users m ON m.id = ma.moderator_user_id
       LEFT JOIN users u ON u.id = ma.target_user_id
       WHERE ma.action IN ('ban_user','unban_user')
       ORDER BY ma.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(filters.limit, filters.offset) as Array<{
    id: number;
    action: string;
    reason: string | null;
    created_at: string;
    target_user_id: number | null;
    moderator_username: string;
    target_username: string | null;
    banned_at: string | null;
    ban_expires_at: string | null;
    status: string;
  }>;

  return {
    total,
    items: rows.map((row) => {
      const currentlyBanned = row.target_user_id
        ? isUserBanned({
            status: row.status || "active",
            banned_at: row.banned_at,
            ban_expires_at: row.ban_expires_at,
          })
        : false;
      return {
        userId: row.target_user_id,
        username: row.target_username,
        reason: row.reason,
        bannedAt: row.action === "ban_user" ? row.created_at : row.banned_at,
        expiresAt: row.ban_expires_at,
        permanent: !row.ban_expires_at,
        lifted: row.action === "unban_user" || !currentlyBanned,
        bannedBy: row.moderator_username,
        action: row.action,
        recordedAt: row.created_at,
      };
    }),
  };
}

export function parseOptionalIso(raw: string | null) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export function parseBanExpiry(raw: unknown) {
  if (raw == null || raw === "") return { ok: true as const, value: null as string | null };
  if (typeof raw !== "string") return { ok: false as const };
  const iso = parseOptionalIso(raw);
  if (!iso) return { ok: false as const };
  if (new Date(iso).getTime() <= Date.now()) return { ok: false as const };
  return { ok: true as const, value: iso };
}

export function adminListHeld(offset: number, limit: number) {
  return listHeldItems(getDb(), offset, limit);
}

export function adminCountHeld() {
  return countHeldItems(getDb());
}

export function adminApproveHeld(
  kind: HeldKind,
  id: number,
  moderator: UserRow,
  reason: string | null,
) {
  return approveHeldContent(getDb(), kind, id, moderator.id, reason);
}

export function adminRejectHeld(
  kind: HeldKind,
  id: number,
  moderator: UserRow,
  reason: string,
) {
  return rejectHeldContent(getDb(), kind, id, moderator.id, reason);
}

export function adminBanHeld(
  kind: HeldKind,
  id: number,
  moderator: UserRow,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false as const, error: "Gerekçe zorunlu.", status: 400 };
  }
  const db = getDb();
  const loaded = loadHeldTarget(db, kind, id);
  if (!loaded.ok) return loaded;
  if (loaded.target.authorRole === "admin") {
    return { ok: false as const, error: "Admin hesap banlanamaz.", status: 409 };
  }
  try {
    return db.transaction(() => {
      const rejected = rejectHeldContent(db, kind, id, moderator.id, trimmed);
      if (!rejected.ok) return rejected;
      const banned = banUser(loaded.target.userId, trimmed, null, moderator.id);
      if (!banned.ok) {
        throw new Error(banned.error);
      }
      return { ok: true as const };
    })();
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Ban başarısız.",
      status: 409,
    };
  }
}
