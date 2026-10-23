import type { Db } from "./db";
import { refreshBadges } from "./profiles";
import { can, canBanRole, roleRank } from "./permissions";
import { formatPhone, maskEmail, maskPhone } from "./privacy";
import { writeAudit } from "./audit";
import { notifyModeration } from "./notifications";
import { getDb } from "./db";
import { FORUM_SYSTEM_PASSWORD_HASH } from "./forum-system";
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

/** The non-login system account that owns the pinned starter topics is not a member. */
const HUMAN = `password_hash IS DISTINCT FROM '${FORUM_SYSTEM_PASSWORD_HASH}'`;
const BY_HUMAN = `user_id NOT IN (SELECT id FROM users WHERE password_hash = '${FORUM_SYSTEM_PASSWORD_HASH}')`;

export async function getDashboardStats() {
  const db = getDb();
  const now = nowIso();
  const totalMembers = (
    await db.prepare(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND ${HUMAN}`).get() as { c: number }
  ).c;
  const activeMembers = (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM users u
         WHERE u.deleted_at IS NULL AND ${HUMAN} AND NOT (${bannedClause("u")})`,
            )
            .get(now) as { c: number }
  ).c;
  const totalTopics = (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM forum_topics
         WHERE deleted_at IS NULL AND held_at IS NULL AND ${BY_HUMAN}`,
            )
            .get() as { c: number }
  ).c;
  const totalPosts = (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM forum_posts
         WHERE deleted_at IS NULL AND held_at IS NULL AND ${BY_HUMAN}`,
            )
            .get() as { c: number }
  ).c;
  const activeBans = (
    await db
            .prepare(`SELECT COUNT(*) as c FROM users u WHERE ${bannedClause("u")}`)
            .get(now) as { c: number }
  ).c;
  const activeForumTeams = (
    await db
            .prepare(`SELECT COUNT(*) as c FROM teams WHERE is_forum_active = 1`)
            .get() as { c: number }
  ).c;

  const validVotes = (
    await db.prepare(`SELECT COUNT(*) as c FROM fan_votes WHERE status = 'active'`).get() as {
      c: number;
    }
  ).c;
  const phoneVerifiedMembers = (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM users WHERE phone_verified_at IS NOT NULL AND deleted_at IS NULL`,
            )
            .get() as { c: number }
  ).c;
  const emailVerifiedMembers = (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM users
         WHERE email_verified_at IS NOT NULL AND phone_verified_at IS NULL AND deleted_at IS NULL`,
            )
            .get() as { c: number }
  ).c;
  /** Old e-mail census ballots: kept for the record, not part of any public count. */
  const legacyCensusVotes = (
    await db.prepare(`SELECT COUNT(*) as c FROM votes WHERE revoked_at IS NULL`).get() as { c: number }
  ).c;

  const recent = await db
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
    phoneVerifiedMembers,
    emailVerifiedMembers,
    legacyCensusVotes,
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
    ...await getDashboardExtras(db),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Growth, distribution, queue and abuse indicators. Every figure is a plain
 * COUNT over live rows; definitions are shown next to each card in the UI.
 */
async function getDashboardExtras(db: Db, nowMs = Date.now()) {
  const since = (days: number) => new Date(nowMs - days * DAY_MS).toISOString();
  const count = async (sql: string, ...params: unknown[]) => (await db.prepare(sql).get(...params) as { c: number }).c;

  const signups = {
    day: await count(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND ${HUMAN} AND created_at >= ?`, since(1)),
    week: await count(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND ${HUMAN} AND created_at >= ?`, since(7)),
    month: await count(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND ${HUMAN} AND created_at >= ?`, since(30)),
  };
  const newTopicsWeek = await count(
      `SELECT COUNT(*) as c FROM forum_topics WHERE deleted_at IS NULL AND held_at IS NULL AND ${BY_HUMAN} AND created_at >= ?`,
      since(7),
    );
  const newPostsWeek = await count(
      `SELECT COUNT(*) as c FROM forum_posts WHERE deleted_at IS NULL AND held_at IS NULL AND ${BY_HUMAN} AND created_at >= ?`,
      since(7),
    );
  const openReports = await count(`SELECT COUNT(*) as c FROM forum_reports WHERE status = 'open'`);
  const held = await countHeldItems(db);

  const teamDistribution = await db
      .prepare(
        `SELECT fv.team_id as teamId, COALESCE(t.name, fv.team_id) as name, COUNT(*) as votes
       FROM fan_votes fv LEFT JOIN teams t ON t.id = fv.team_id
       WHERE fv.status = 'active' GROUP BY fv.team_id, t.name ORDER BY votes DESC, name LIMIT 10`,
      )
      .all() as { teamId: string; name: string; votes: number }[];
  const provinceDistribution = await db
      .prepare(
        `SELECT city as province, COUNT(*) as votes FROM fan_votes
       WHERE status = 'active' AND city IS NOT NULL GROUP BY city ORDER BY votes DESC, city LIMIT 10`,
      )
      .all() as { province: string; votes: number }[];
  const votesWithoutProvince = await count(
      `SELECT COUNT(*) as c FROM fan_votes WHERE status = 'active' AND city IS NULL`,
    );

  const day = since(1);
  const suspicious = {
    /** SMS codes requested in the last 24 hours (each one is a paid SMS in production). */
    otpRequests: await count(`SELECT COUNT(*) as c FROM auth_otps WHERE created_at >= ?`, day),
    /** Codes locked after too many wrong guesses in the last 24 hours. */
    otpLockouts: await count(
          `SELECT COUNT(*) as c FROM auth_otps WHERE created_at >= ? AND attempts >= max_attempts`,
          day,
        ),
    /** Most sign-ups in a single clock hour over the last 24 hours (a burst hints at scripted sign-ups). */
    signupPeakHour: await count(
          `SELECT COALESCE(MAX(n), 0) as c FROM (SELECT COUNT(*) as n FROM users WHERE ${HUMAN} AND created_at >= ?
       GROUP BY substr(created_at, 1, 13))`,
          day,
        ),
    /** Members who tried a staff-only action in the last 24 hours. */
    deniedAdminAttempts: await count(
          `SELECT COUNT(*) as c FROM security_events WHERE created_at >= ? AND action LIKE 'admin_denied:%'`,
          day,
        ),
    /** Failed staff sign-ins / 2FA checks in the last 24 hours. */
    failedStaffLogins: await count(
          `SELECT COUNT(*) as c FROM security_events WHERE created_at >= ? AND success = 0
       AND action NOT LIKE 'admin_denied:%'`,
          day,
        ),
    /** Votes voided by staff in the last 30 days. */
    votesVoided30d: await count(
          `SELECT COUNT(*) as c FROM fan_votes WHERE status = 'void' AND voided_at >= ?`,
          since(30),
        ),
  };

  const recentAdmin = await db
      .prepare(
        `SELECT a.id, a.action, a.target_type as targetType, a.target_id as targetId, a.reason,
              a.created_at as createdAt, u.username as actor
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.id DESC LIMIT 10`,
      )
      .all() as {
    id: number;
    action: string;
    targetType: string | null;
    targetId: string | null;
    reason: string | null;
    createdAt: string;
    actor: string | null;
  }[];

  return {
    signups,
    newTopicsWeek,
    newPostsWeek,
    openReports,
    heldItems: held,
    teamDistribution,
    provinceDistribution,
    votesWithoutProvince,
    suspicious,
    recentAdmin,
  };
}

export type UserListFilters = {
  q: string | null;
  role: UserRole | null;
  banned: boolean | null;
  teamId: string | null;
  /** Whether the viewer may search by phone / e-mail / real name. */
  pii: boolean;
  offset: number;
  limit: number;
};

export async function listAdminUsers(filters: UserListFilters) {
  const db = getDb();
  const now = nowIso();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];

  if (filters.q && !filters.pii) {
    where.push(`(u.username_norm ILIKE ? OR u.display_name ILIKE ?)`);
    params.push(filters.q, filters.q);
  } else if (filters.q) {
    where.push(
      `(u.username_norm ILIKE ? OR u.email_norm ILIKE ? OR u.display_name ILIKE ?
        OR COALESCE(u.first_name,'') ILIKE ? OR COALESCE(u.last_name,'') ILIKE ?
        OR COALESCE(u.phone,'') ILIKE ? OR COALESCE(u.phone_norm,'') ILIKE ?)`,
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
    await db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${whereSql}`).get(...params) as {
      c: number;
    }
  ).c;

  const rows = await db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.team_id, u.status, u.role,
              u.created_at, u.last_login_at, u.banned_at, u.ban_reason, u.ban_expires_at,
              u.phone_verified_at, u.email_verified_at, u.deleted_at, tm.name as team_name
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
    phone_verified_at: string | null;
    email_verified_at: string | null;
    deleted_at: string | null;
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
      role: row.role,
      phoneVerified: Boolean(row.phone_verified_at),
      emailVerified: Boolean(row.email_verified_at),
      deleted: Boolean(row.deleted_at),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      banned: isUserBanned(row),
      bannedAt: row.banned_at,
      banExpiresAt: row.ban_expires_at,
    })),
  };
}

export async function listAdminTeamOptions() {
  return await getDb()
      .prepare(
        `SELECT id, name FROM teams WHERE id IN (SELECT DISTINCT team_id FROM users WHERE team_id IS NOT NULL)
       UNION
       SELECT id, name FROM teams WHERE is_forum_active = 1
       ORDER BY name`,
      )
      .all() as Array<{ id: string; name: string }>;
}

/**
 * `viewerRole` decides how much personal data comes back: moderators see
 * the account and its forum history only; admins also see the e-mail and
 * profile fields. The phone number is always masked.
 */
export async function getAdminUserDetail(id: number, viewerRole: string) {
  const pii = can(viewerRole, "users.pii");
  const user = await findUserById(id);
  if (!user) return null;
  const team = user.team_id
    ? (await getDb()
              .prepare(`SELECT id, name FROM teams WHERE id = ?`)
              .get(user.team_id) as { id: string; name: string } | undefined)
    : undefined;

  const vote = await getDb()
      .prepare(
        `SELECT v.team_id, t.name as team_name, v.city, v.cast_at, v.status, v.voided_at, v.void_reason
       FROM fan_votes v LEFT JOIN teams t ON t.id = v.team_id WHERE v.user_id = ?`,
      )
      .get(id) as
    | {
        team_id: string;
        team_name: string | null;
        city: string;
        cast_at: string;
        status: string;
        voided_at: string | null;
        void_reason: string | null;
      }
    | undefined;

  const topics = await getDb()
      .prepare(
        `SELECT id, team_id, title, created_at, locked_at, deleted_at, held_at
       FROM forum_topics WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
      )
      .all(id) as Array<{
    id: number;
    team_id: string;
    board: string;
    city: string | null;
    title: string;
    created_at: string;
    locked_at: string | null;
    deleted_at: string | null;
    held_at: string | null;
  }>;

  const posts = await getDb()
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
    email: pii ? user.email : maskEmail(user.email),
    phoneMasked: maskPhone(user.phone_norm ?? user.phone),
    phoneVerified: Boolean(user.phone_verified_at),
    emailVerified: Boolean(user.email_verified_at),
    firstName: pii ? user.first_name : null,
    lastName: pii ? user.last_name : null,
    birthDate: pii ? user.birth_date : null,
    city: user.city,
    deleted: Boolean(user.deleted_at),
    vote: vote
      ? {
          teamId: vote.team_id,
          teamName: vote.team_name,
          city: vote.city,
          castAt: vote.cast_at,
          status: vote.status,
          voidedAt: vote.voided_at,
          voidReason: vote.void_reason,
        }
      : null,
    teamId: user.team_id,
    teamName: team?.name ?? null,
    status: user.status,
    role: user.role,
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

export async function adminBanUser(
  targetId: number,
  reason: string,
  expiresAt: string | null,
  moderator: UserRow,
) {
  const db = getDb();
  const denied = await banPermissionError(targetId, moderator);
  if (denied) return denied;
  return db.transaction(() => banUser(targetId, reason, expiresAt, moderator.id))();
}

async function banPermissionError(targetId: number, moderator: UserRow) {
  const target = await findUserById(targetId);
  if (!target) return { ok: false as const, error: "Kullanıcı bulunamadı." };
  if (target.id === moderator.id) {
    return { ok: false as const, error: "Kendi hesabın üzerinde ban işlemi yapamazsın." };
  }
  if (!canBanRole(moderator.role, target.role)) {
    return { ok: false as const, error: "Bu hesabın banını değiştirme yetkin yok." };
  }
  return null;
}

export async function adminUnbanUser(targetId: number, reason: string, moderator: UserRow) {
  const db = getDb();
  const denied = await banPermissionError(targetId, moderator);
  if (denied) return denied;
  return db.transaction(() => unbanUser(targetId, reason, moderator.id))();
}

/**
 * Full phone number of one member for a super admin (KVKK: everyone else
 * only ever sees the masked form). The audit row is written before the
 * number is returned, so there is no reveal without a record of who looked,
 * at whom and when. The number itself never goes into the audit row.
 */
export async function adminRevealPhone(targetId: number, viewer: UserRow) {
  const user = await findUserById(targetId);
  if (!user) return { ok: false as const, status: 404, error: "Kullanıcı bulunamadı." };
  const phone = formatPhone(user.phone_norm ?? user.phone);
  if (!phone) return { ok: false as const, status: 404, error: "Bu üyenin kayıtlı telefonu yok." };
  await writeAudit(getDb(), {
    actorUserId: viewer.id,
    action: "user_phone_view",
    targetType: "user",
    targetId,
    meta: { targetUsername: user.username },
  });
  return { ok: true as const, phone };
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

/** Team id, or "board:general" / "board:city" for the open boards. */
function pushBoardFilter(value: string | null, where: string[], params: unknown[]) {
  if (!value) return;
  if (value === "board:general") {
    where.push(`t.board = 'general'`);
    return;
  }
  if (value === "board:city") {
    where.push(`t.board = 'city'`);
    return;
  }
  where.push(`t.team_id = ?`);
  params.push(value);
}

export async function listAdminTopics(filters: TopicListFilters) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  pushBoardFilter(filters.teamId, where, params);
  if (filters.q) {
    where.push(`t.title ILIKE ?`);
    params.push(filters.q);
  }
  if (filters.deleted === "live") {
    where.push(`t.deleted_at IS NULL AND t.held_at IS NULL`);
  }
  if (filters.deleted === "deleted") where.push(`t.deleted_at IS NOT NULL`);

  const whereSql = where.join(" AND ");
  const total = (
    await db.prepare(`SELECT COUNT(*) as c FROM forum_topics t WHERE ${whereSql}`).get(...params) as {
      c: number;
    }
  ).c;

  const rows = await db
      .prepare(
        `SELECT t.id, t.team_id, t.board, t.city, t.title, t.created_at, t.locked_at, t.deleted_at, t.held_at, t.user_id,
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
    board: string;
    city: string | null;
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
      board: row.board,
      city: row.city,
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

export async function listAdminPosts(filters: PostListFilters) {
  const db = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  pushBoardFilter(filters.teamId, where, params);
  if (filters.topicId) {
    where.push(`p.topic_id = ?`);
    params.push(filters.topicId);
  }
  if (filters.q) {
    where.push(`p.content ILIKE ?`);
    params.push(filters.q);
  }
  if (filters.deleted === "live") {
    where.push(`p.deleted_at IS NULL AND p.held_at IS NULL`);
  }
  if (filters.deleted === "deleted") where.push(`p.deleted_at IS NOT NULL`);

  const whereSql = where.join(" AND ");
  const total = (
    await db
            .prepare(
              `SELECT COUNT(*) as c
         FROM forum_posts p
         JOIN forum_topics t ON t.id = p.topic_id
         WHERE ${whereSql}`,
            )
            .get(...params) as { c: number }
  ).c;

  const rows = await db
      .prepare(
        `SELECT p.id, p.topic_id, p.content, p.created_at, p.deleted_at, p.held_at, p.user_id,
              u.username, t.title as topic_title, t.team_id, t.board, t.city, tm.name as team_name
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
    board: string;
    city: string | null;
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
      board: row.board,
      city: row.city,
      content: row.content.slice(0, 400),
      createdAt: row.created_at,
      deleted: Boolean(row.deleted_at),
      held: Boolean(row.held_at),
      author: { id: row.user_id, username: row.username },
    })),
  };
}

/**
 * Moderators can't act on content by staff of the same or higher rank
 * (same rule as bans). Super admins can act on anything.
 */
async function contentRankError(authorId: number, moderator: UserRow) {
  if (authorId === moderator.id || moderator.role === "super_admin") return null;
  const author = await getDb().prepare(`SELECT role FROM users WHERE id = ?`).get(authorId) as { role: string } | undefined;
  if (author && roleRank(author.role) >= roleRank(moderator.role)) {
    return { ok: false as const, error: "Aynı veya daha yüksek yetkili birinin içeriğine işlem yapamazsın.", status: 403 };
  }
  return null;
}

export async function lockTopicAdmin(topicId: number, lock: boolean, reason: string, moderator: UserRow) {
  const topic = await findTopic(topicId);
  if (!topic) return { ok: false as const, error: "Konu bulunamadı.", status: 404 };
  if (topic.deleted_at) return { ok: false as const, error: "Silinmiş konu kilitlenemez.", status: 409 };
  const rank = await contentRankError(topic.user_id, moderator);
  if (rank) return rank;

  if (lock && topic.locked_at) return { ok: true as const };
  if (!lock && !topic.locked_at) return { ok: true as const };

  const db = getDb();
  await db.transaction(async () => {
        await setTopicLocked(topicId, lock);
        await recordModerationAction({
                moderatorUserId: moderator.id,
                targetTopicId: topicId,
                targetUserId: topic.user_id,
                action: lock ? "lock_topic" : "unlock_topic",
                reason,
              });
      })();
  return { ok: true as const };
}

export async function deleteTopicAdmin(topicId: number, reason: string, moderator: UserRow) {
  const topic = await findTopic(topicId);
  if (!topic) return { ok: false as const, error: "Konu bulunamadı.", status: 404 };
  if (topic.deleted_at) return { ok: false as const, error: "Konu zaten silinmiş.", status: 409 };
  const rank = await contentRankError(topic.user_id, moderator);
  if (rank) return rank;

  const db = getDb();
  const ok = await db.transaction(async () => {
      const deleted = await adminSoftDeleteTopic(topicId);
      if (!deleted) return false;
      await recordModerationAction({
              moderatorUserId: moderator.id,
              targetTopicId: topicId,
              targetUserId: topic.user_id,
              action: "delete_topic",
              reason,
            });
      await notifyModeration(db, {
              userId: topic.user_id,
              topicId,
              body: `"${topic.title.slice(0, 80)}" konun moderatör tarafından kaldırıldı. Gerekçe: ${reason.slice(0, 160)}`,
            });
      return true;
    })();
  if (!ok) return { ok: false as const, error: "Konu silinemedi.", status: 409 };
  return { ok: true as const };
}

export async function deletePostAdmin(postId: number, reason: string, moderator: UserRow) {
  const post = await findPost(postId);
  if (!post) return { ok: false as const, error: "Mesaj bulunamadı.", status: 404 };
  if (post.deleted_at) return { ok: false as const, error: "Mesaj zaten silinmiş.", status: 409 };
  const rank = await contentRankError(post.user_id, moderator);
  if (rank) return rank;

  const db = getDb();
  const ok = await db.transaction(async () => {
      const deleted = await adminSoftDeletePost(postId);
      if (!deleted) return false;
      await recordModerationAction({
              moderatorUserId: moderator.id,
              targetPostId: postId,
              targetTopicId: post.topic_id,
              targetUserId: post.user_id,
              action: "delete_post",
              reason,
            });
      await notifyModeration(db, {
              userId: post.user_id,
              topicId: post.topic_id,
              postId,
              body: `Bir yorumun moderatör tarafından kaldırıldı. Gerekçe: ${reason.slice(0, 160)}`,
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

export async function listModeration(filters: ModerationFilters) {
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
    where.push(`m.username ILIKE ?`);
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
    await db
            .prepare(
              `SELECT COUNT(*) as c
         FROM moderation_actions ma
         JOIN users m ON m.id = ma.moderator_user_id
         WHERE ${whereSql}`,
            )
            .get(...params) as { c: number }
  ).c;

  const rows = await db
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

export async function listBans(filters: BanListFilters) {
  const db = getDb();
  const now = nowIso();

  if (filters.state === "active") {
    const where = bannedClause("u");
    const total = (
      await db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${where}`).get(now) as { c: number }
    ).c;
    const rows = await db
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
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM moderation_actions
         WHERE action IN ('ban_user','unban_user')`,
            )
            .get() as { c: number }
  ).c;
  const rows = await db
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

export async function adminApproveHeld(
  kind: HeldKind,
  id: number,
  moderator: UserRow,
  reason: string | null,
) {
  const result = await approveHeldContent(getDb(), kind, id, moderator.id, reason);
  if (result.ok) {
    const author = await getDb()
          .prepare(kind === "topic" ? `SELECT user_id FROM forum_topics WHERE id = ?` : `SELECT user_id FROM forum_posts WHERE id = ?`)
          .get(id) as { user_id: number } | undefined;
    if (author) await refreshBadges(getDb(), author.user_id);
  }
  return result;
}

export function adminRejectHeld(
  kind: HeldKind,
  id: number,
  moderator: UserRow,
  reason: string,
) {
  return rejectHeldContent(getDb(), kind, id, moderator.id, reason);
}

export async function adminBanHeld(
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
  const loaded = await loadHeldTarget(db, kind, id);
  if (!loaded.ok) return loaded;
  if (!canBanRole(moderator.role, loaded.target.authorRole)) {
    return { ok: false as const, error: "Bu hesabı banlama yetkin yok.", status: 409 };
  }
  try {
    return await db.transaction(async () => {
          const rejected = await rejectHeldContent(db, kind, id, moderator.id, trimmed);
          if (!rejected.ok) return rejected;
          const banned = await banUser(loaded.target.userId, trimmed, null, moderator.id);
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
