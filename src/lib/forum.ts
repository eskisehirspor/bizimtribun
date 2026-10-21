import { getDb } from "./db";
import { hmac } from "./crypto";
import { hashedIp, registerAttemptCount } from "./stats";
import { noteAuthAttempt } from "./users";
import {
  FORUM_BODY_MAX,
  FORUM_PAGE_DEFAULT,
  FORUM_PAGE_MAX,
  FORUM_POST_MAX,
  FORUM_POSTS_PER_IP_HOUR,
  FORUM_EDITS_PER_USER_HOUR,
  FORUM_POSTS_PER_USER_HOUR,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
  FORUM_TOPICS_PER_IP_HOUR,
  FORUM_TOPICS_PER_USER_HOUR,
} from "./policy";
import {
  FORUM_CATEGORY_DEFAULT,
  isForumCategory,
  topicOrderSql,
  type ForumCategory,
  type TopicSort,
} from "./forum-category";
import {
  getCurrentFanOfWeekUserId,
  getFanOfWeekHistory as queryFanOfWeekHistory,
} from "./forum-leaders";
import { isPublicForumRow } from "./moderation/forum-gate";
import { getSettings } from "./site-settings";
import { isStaffRole } from "./permissions";

export type ForumTeam = {
  id: string;
  name: string;
  league: string;
  is_forum_active: number;
};

export type ForumBoardKind = "team" | "general" | "city";

/** Where a topic lives: a team's tribune, the general tribune, or a province. */
export type ForumBoardRef =
  | { kind: "team"; teamId: string }
  | { kind: "general" }
  | { kind: "city"; city: string };

export type ForumTopic = {
  id: number;
  board: ForumBoardKind;
  team_id: string | null;
  city: string | null;
  edited_at: string | null;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  locked_at: string | null;
  deleted_at: string | null;
  held_at: string | null;
  category: ForumCategory;
  is_pinned: number;
};

function topicCategory(raw: unknown): ForumCategory {
  return isForumCategory(raw) ? raw : FORUM_CATEGORY_DEFAULT;
}

function topicPinned(raw: unknown) {
  return Number(raw) ? 1 : 0;
}

export type ForumPost = {
  id: number;
  topic_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  held_at: string | null;
  edited_at?: string | null;
};

export type ForumAuthor = {
  id: number;
  username: string;
  isFanOfWeek: boolean;
};

function authorOf(userId: number, leaderUserId: number | null): ForumAuthor | undefined {
  const row = getDb()
    .prepare(`SELECT id, username FROM users WHERE id = ?`)
    .get(userId) as { id: number; username: string } | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    isFanOfWeek: leaderUserId != null && row.id === leaderUserId,
  };
}

export function cleanForumText(raw: string, max: number) {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text || !text.replace(/\s/g, "").length) return null;
  if (text.length > max) return null;
  return text;
}

export function cleanForumTitle(raw: string) {
  const title = raw.replace(/\s+/g, " ").trim();
  if (title.length < FORUM_TITLE_MIN || title.length > FORUM_TITLE_MAX) return null;
  return title;
}

export function parsePageLimit(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  let limit = Number(url.searchParams.get("limit") || FORUM_PAGE_DEFAULT) || FORUM_PAGE_DEFAULT;
  if (limit < 1) limit = FORUM_PAGE_DEFAULT;
  if (limit > FORUM_PAGE_MAX) limit = FORUM_PAGE_MAX;
  return { page, limit, offset: (page - 1) * limit };
}

export function parseIdParam(raw: string) {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

export function findForumTeam(slug: string) {
  return getDb()
    .prepare(`SELECT id, name, league, is_forum_active FROM teams WHERE id = ?`)
    .get(slug) as ForumTeam | undefined;
}

/** Is the board this topic lives on open? (Team boards can be closed by admins.) */
export function topicBoardOpen(topic: Pick<ForumTopic, "board" | "team_id" | "city">) {
  const board = boardOfTopic(topic);
  if (board.kind === "team") return Boolean(requireForumBoard(board.teamId));
  const { features } = getSettings();
  // Province boards were removed; their old topics stay stored but hidden.
  if (board.kind === "city") return false;
  return features.generalBoardOpen;
}

export function requireForumBoard(slug: string) {
  const team = findForumTeam(slug);
  if (!team || !team.is_forum_active) return undefined;
  return team;
}

/** Who is looking at a board. Only id and role matter here. */
export type BoardViewer = { id: number; role: string | null } | null | undefined;

export type BoardAccess = { ok: true } | { ok: false; status: 401 | 403; error: string; code: string };

export const TEAM_BOARD_LOGIN_ERROR = "Takım tribünleri yalnızca o takımın taraftarlarına açık. Görmek için giriş yap.";
export const TEAM_BOARD_OTHER_TEAM_ERROR = "Bu tribün yalnızca bu takıma oy veren taraftarlara açık.";

/** The team the member counts for: their active vote. No vote, no team tribune. */
export function memberTeamId(userId: number) {
  const row = getDb()
    .prepare(`SELECT team_id FROM fan_votes WHERE user_id = ? AND status = 'active'`)
    .get(userId) as { team_id: string } | undefined;
  return row?.team_id ?? null;
}

/**
 * Team tribunes are for that team's fans only (reading and writing).
 * Moderators and admins can read every team tribune so they can moderate,
 * but write only in their own team's tribune like any fan.
 * The Milli Takım Tribünü (board 'general') is open to everyone.
 */
export function boardAccess(
  board: ForumBoardRef,
  viewer: BoardViewer,
  mode: "read" | "write" = "read",
): BoardAccess {
  if (board.kind !== "team") return { ok: true };
  if (!viewer) return { ok: false, status: 401, error: TEAM_BOARD_LOGIN_ERROR, code: "TEAM_BOARD_LOGIN" };
  if (mode === "read" && isStaffRole(viewer.role)) return { ok: true };
  if (memberTeamId(viewer.id) === board.teamId) return { ok: true };
  return { ok: false, status: 403, error: TEAM_BOARD_OTHER_TEAM_ERROR, code: "TEAM_BOARD_OTHER_TEAM" };
}

export function topicAccess(
  topic: Pick<ForumTopic, "board" | "team_id" | "city">,
  viewer: BoardViewer,
  mode: "read" | "write" = "read",
) {
  return boardAccess(boardOfTopic(topic), viewer, mode);
}

/** SQL filter for lists that mix boards: hides team topics the viewer may not read. */
export function visibleBoardSql(alias: string, viewer: BoardViewer) {
  if (viewer && isStaffRole(viewer.role)) return { sql: "", params: [] as (string | number)[] };
  if (!viewer) return { sql: `AND ${alias}.board != 'team'`, params: [] as (string | number)[] };
  return {
    sql: `AND (${alias}.board != 'team' OR ${alias}.team_id =
      (SELECT fv.team_id FROM fan_votes fv WHERE fv.user_id = ? AND fv.status = 'active'))`,
    params: [viewer.id] as (string | number)[],
  };
}


function toBoardRef(board: ForumBoardRef | string): ForumBoardRef {
  return typeof board === "string" ? { kind: "team", teamId: board } : board;
}

function boardWhere(board: ForumBoardRef) {
  if (board.kind === "team") return { sql: `t.board = 'team' AND t.team_id = ?`, params: [board.teamId] };
  if (board.kind === "city") return { sql: `t.board = 'city' AND t.city = ?`, params: [board.city] };
  return { sql: `t.board = 'general'`, params: [] as string[] };
}

export function boardOfTopic(topic: Pick<ForumTopic, "board" | "team_id" | "city">): ForumBoardRef {
  if (topic.board === "city" && topic.city) return { kind: "city", city: topic.city };
  if (topic.board === "general") return { kind: "general" };
  return { kind: "team", teamId: topic.team_id ?? "" };
}

/** "Haftanın Taraftarı" exists only on team boards: last week's winner wears the torch. */
function leaderForBoard(board: ForumBoardRef) {
  return board.kind === "team" ? getCurrentFanOfWeekUserId(board.teamId, getDb()) : null;
}

/** Hides members the viewer blocked. `col` is the author column. */
function blockedSql(col: string, viewerId: number | null | undefined) {
  if (!viewerId) return { sql: "", params: [] as number[] };
  return {
    sql: `AND ${col} NOT IN (SELECT blocked_user_id FROM user_blocks WHERE blocker_user_id = ?)`,
    params: [viewerId],
  };
}

function likeCols(type: "topic" | "post", alias: string, viewerId: number | null | undefined) {
  const count = `(SELECT COUNT(*) FROM forum_likes l WHERE l.target_type = '${type}' AND l.target_id = ${alias}.id) as like_count`;
  const mine = viewerId
    ? `, EXISTS(SELECT 1 FROM forum_likes l WHERE l.target_type = '${type}' AND l.target_id = ${alias}.id AND l.user_id = ?) as liked_by_me`
    : `, 0 as liked_by_me`;
  return { sql: `${count}${mine}`, params: viewerId ? [viewerId] : ([] as number[]) };
}

export { isPublicForumRow };

function normalizeTopic(row: ForumTopic | undefined) {
  if (!row) return undefined;
  return {
    ...row,
    category: topicCategory(row.category),
    is_pinned: topicPinned(row.is_pinned),
  };
}

export function findTopic(id: number) {
  return normalizeTopic(
    getDb()
      .prepare(`SELECT * FROM forum_topics WHERE id = ?`)
      .get(id) as ForumTopic | undefined,
  );
}

export function findLiveTopic(id: number) {
  const topic = findTopic(id);
  if (!topic || !isPublicForumRow(topic)) return undefined;
  return topic;
}

export function findPost(id: number) {
  return getDb()
    .prepare(`SELECT * FROM forum_posts WHERE id = ?`)
    .get(id) as ForumPost | undefined;
}

export function findLivePost(id: number) {
  const post = findPost(id);
  if (!post || !isPublicForumRow(post)) return undefined;
  return post;
}

export function listTopics(
  boardInput: ForumBoardRef | string,
  offset: number,
  limit: number,
  opts?: { category?: ForumCategory | null; sort?: TopicSort; viewerId?: number | null },
) {
  const board = toBoardRef(boardInput);
  const category = opts?.category ?? null;
  const sort: TopicSort = opts?.sort ?? "activity";
  const where = boardWhere(board);
  const catSql = category ? `AND t.category = ?` : "";
  const catParams = category ? [category] : [];
  const blocked = blockedSql("t.user_id", opts?.viewerId);
  const likes = likeCols("topic", "t", opts?.viewerId);
  const total = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM forum_topics t
         WHERE ${where.sql} AND t.deleted_at IS NULL AND t.held_at IS NULL ${catSql} ${blocked.sql}`,
      )
      .get(...where.params, ...catParams, ...blocked.params) as { c: number }
  ).c;

  const rows = getDb()
    .prepare(
      `SELECT t.*, u.username,
              (SELECT COUNT(*) FROM forum_posts p
               WHERE p.topic_id = t.id AND p.deleted_at IS NULL AND p.held_at IS NULL) as post_count,
              ${likes.sql}
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE ${where.sql} AND t.deleted_at IS NULL AND t.held_at IS NULL ${catSql} ${blocked.sql}
       ORDER BY ${topicOrderSql(sort)}
       LIMIT ? OFFSET ?`,
    )
    .all(...likes.params, ...where.params, ...catParams, ...blocked.params, limit, offset) as (ForumTopic & {
    username: string;
    post_count: number;
    like_count: number;
    liked_by_me: number;
  })[];

  const leaderUserId = leaderForBoard(board);

  return {
    total,
    topics: rows.map((t) => ({
      id: t.id,
      board: t.board,
      teamId: t.team_id,
      province: t.city,
      title: t.title,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      lockedAt: t.locked_at,
      category: topicCategory(t.category),
      isPinned: Boolean(topicPinned(t.is_pinned)),
      postCount: t.post_count,
      likeCount: t.like_count,
      likedByMe: Boolean(t.liked_by_me),
      author: {
        id: t.user_id,
        username: t.username,
        isFanOfWeek: leaderUserId != null && t.user_id === leaderUserId,
      },
    })),
  };
}

export function listPosts(
  topicId: number,
  offset: number,
  limit: number,
  viewerId?: number | null,
) {
  const topic = findTopic(topicId);
  const leaderUserId = topic ? leaderForBoard(boardOfTopic(topic)) : null;
  const blocked = blockedSql("p.user_id", viewerId);
  const likes = likeCols("post", "p", viewerId);
  const total = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM forum_posts p
         WHERE p.topic_id = ? AND p.deleted_at IS NULL AND p.held_at IS NULL ${blocked.sql}`,
      )
      .get(topicId, ...blocked.params) as { c: number }
  ).c;

  const rows = getDb()
    .prepare(
      `SELECT p.*, u.username, ${likes.sql}
       FROM forum_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.topic_id = ? AND p.deleted_at IS NULL AND p.held_at IS NULL ${blocked.sql}
       ORDER BY p.created_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...likes.params, topicId, ...blocked.params, limit, offset) as (ForumPost & {
    username: string;
    like_count: number;
    liked_by_me: number;
  })[];

  return {
    total,
    posts: rows.map((p) => ({
      id: p.id,
      topicId: p.topic_id,
      content: p.content,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      editedAt: p.edited_at ?? null,
      likeCount: p.like_count,
      likedByMe: Boolean(p.liked_by_me),
      author: {
        id: p.user_id,
        username: p.username,
        isFanOfWeek: leaderUserId != null && p.user_id === leaderUserId,
      },
    })),
  };
}

function likeState(type: "topic" | "post", id: number, viewerId?: number | null) {
  const count = (
    getDb()
      .prepare(`SELECT COUNT(*) as c FROM forum_likes WHERE target_type = ? AND target_id = ?`)
      .get(type, id) as { c: number }
  ).c;
  const mine = viewerId
    ? Boolean(
        getDb()
          .prepare(
            `SELECT 1 FROM forum_likes WHERE target_type = ? AND target_id = ? AND user_id = ?`,
          )
          .get(type, id, viewerId),
      )
    : false;
  return { likeCount: count, likedByMe: mine };
}

export function serializeTopic(topic: ForumTopic, viewerId?: number | null) {
  const leaderUserId = leaderForBoard(boardOfTopic(topic));
  return {
    id: topic.id,
    board: topic.board,
    teamId: topic.team_id,
    province: topic.city,
    editedAt: topic.edited_at ?? null,
    ...likeState("topic", topic.id, viewerId),
    title: topic.title,
    content: topic.content,
    createdAt: topic.created_at,
    updatedAt: topic.updated_at,
    lockedAt: topic.locked_at,
    category: topicCategory(topic.category),
    isPinned: Boolean(topicPinned(topic.is_pinned)),
    author: authorOf(topic.user_id, leaderUserId),
  };
}

export function createTopic(input: {
  teamId?: string;
  board?: ForumBoardRef;
  userId: number;
  title: string;
  content: string;
  category?: ForumCategory;
  holdForReview?: boolean;
}) {
  const now = new Date().toISOString();
  const heldAt = input.holdForReview ? now : null;
  const category = topicCategory(input.category ?? FORUM_CATEGORY_DEFAULT);
  const board: ForumBoardRef = input.board ?? { kind: "team", teamId: input.teamId ?? "" };
  const info = getDb()
    .prepare(
      `INSERT INTO forum_topics
       (board, team_id, city, user_id, title, content, created_at, updated_at, held_at, category, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      board.kind,
      board.kind === "team" ? board.teamId : null,
      board.kind === "city" ? board.city : null,
      input.userId,
      input.title,
      input.content,
      now,
      now,
      heldAt,
      category,
    );
  return findTopic(Number(info.lastInsertRowid))!;
}

function recordEdit(
  type: "topic" | "post",
  id: number,
  userId: number,
  oldTitle: string | null,
  oldContent: string,
  now: string,
) {
  getDb()
    .prepare(
      `INSERT INTO forum_edits (target_type, target_id, user_id, old_title, old_content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(type, id, userId, oldTitle, oldContent, now);
}

/** Author edit. The previous version is kept in forum_edits for moderators. */
export function updateTopic(
  id: number,
  userId: number,
  patch: {
    title: string;
    content: string;
    category?: ForumCategory;
    holdForReview?: boolean;
  },
) {
  const now = new Date().toISOString();
  const heldAt = patch.holdForReview ? now : null;
  return getDb().transaction(() => {
    const before = findTopic(id);
    if (!before || before.user_id !== userId || before.deleted_at || before.held_at) return false;
    const result = getDb()
      .prepare(
        `UPDATE forum_topics
         SET title = ?, content = ?, category = ?, updated_at = ?, held_at = ?, edited_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
      )
      .run(patch.title, patch.content, patch.category ?? before.category, now, heldAt, now, id, userId);
    if (result.changes !== 1) return false;
    if (before.title !== patch.title || before.content !== patch.content) {
      recordEdit("topic", id, userId, before.title, before.content, now);
    }
    return true;
  })();
}

export function softDeleteTopic(id: number, userId: number) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE forum_topics
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, id, userId);
  return result.changes === 1;
}

export function createPost(input: {
  topicId: number;
  userId: number;
  content: string;
  holdForReview?: boolean;
}) {
  const now = new Date().toISOString();
  const heldAt = input.holdForReview ? now : null;
  const info = getDb()
    .prepare(
      `INSERT INTO forum_posts (topic_id, user_id, content, created_at, updated_at, held_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.topicId, input.userId, input.content, now, now, heldAt);
  getDb()
    .prepare(`UPDATE forum_topics SET updated_at = ? WHERE id = ?`)
    .run(now, input.topicId);
  return findPost(Number(info.lastInsertRowid))!;
}

export function updatePost(
  id: number,
  userId: number,
  content: string,
  holdForReview = false,
) {
  const now = new Date().toISOString();
  const heldAt = holdForReview ? now : null;
  return getDb().transaction(() => {
    const before = findPost(id);
    if (!before || before.user_id !== userId || before.deleted_at || before.held_at) return false;
    const result = getDb()
      .prepare(
        `UPDATE forum_posts
         SET content = ?, updated_at = ?, held_at = ?, edited_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
      )
      .run(content, now, heldAt, now, id, userId);
    if (result.changes !== 1) return false;
    if (before.content !== content) recordEdit("post", id, userId, null, before.content, now);
    return true;
  })();
}

export function softDeletePost(id: number, userId: number) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE forum_posts
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, id, userId);
  return result.changes === 1;
}

export function serializePost(post: ForumPost, viewerId?: number | null) {
  const topic = findTopic(post.topic_id);
  const leaderUserId = topic ? leaderForBoard(boardOfTopic(topic)) : null;
  return {
    id: post.id,
    editedAt: post.edited_at ?? null,
    ...likeState("post", post.id, viewerId),
    topicId: post.topic_id,
    content: post.content,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    author: authorOf(post.user_id, leaderUserId),
  };
}

export function setTopicLocked(id: number, locked: boolean) {
  const topic = findTopic(id);
  if (!topic || topic.deleted_at) return false;
  const now = new Date().toISOString();
  if (locked) {
    if (topic.locked_at) return true;
    const result = getDb()
      .prepare(
        `UPDATE forum_topics SET locked_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(now, now, id);
    return result.changes === 1;
  }
  const result = getDb()
    .prepare(
      `UPDATE forum_topics SET locked_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(now, id);
  return result.changes === 1;
}

export function adminSoftDeleteTopic(id: number) {
  const topic = findTopic(id);
  if (!topic || topic.deleted_at) return false;
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE forum_topics SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, id);
  return result.changes === 1;
}

export function adminSoftDeletePost(id: number) {
  const post = findPost(id);
  if (!post || post.deleted_at) return false;
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE forum_posts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, id);
  return result.changes === 1;
}

export function forumTopicLimited(ip: string, userId: number) {
  const ipHash = hashedIp(`forum-topic:${ip}`);
  const userHash = hmac(`forum-topic-user:${userId}`);
  return (
    registerAttemptCount(ipHash) >= FORUM_TOPICS_PER_IP_HOUR ||
    registerAttemptCount(userHash) >= FORUM_TOPICS_PER_USER_HOUR
  );
}

export function forumPostLimited(ip: string, userId: number) {
  const ipHash = hashedIp(`forum-post:${ip}`);
  const userHash = hmac(`forum-post-user:${userId}`);
  return (
    registerAttemptCount(ipHash) >= FORUM_POSTS_PER_IP_HOUR ||
    registerAttemptCount(userHash) >= FORUM_POSTS_PER_USER_HOUR
  );
}

export function noteForumTopicAttempt(ip: string, userId: number) {
  noteAuthAttempt(hashedIp(`forum-topic:${ip}`));
  noteAuthAttempt(hmac(`forum-topic-user:${userId}`));
}

export function noteForumPostAttempt(ip: string, userId: number) {
  noteAuthAttempt(hashedIp(`forum-post:${ip}`));
  noteAuthAttempt(hmac(`forum-post-user:${userId}`));
}

/** Counts the edit and says whether the member is over the hourly edit limit. */
export function forumEditLimited(userId: number) {
  const key = hmac(`forum-edit-user:${userId}`);
  if (registerAttemptCount(key) >= FORUM_EDITS_PER_USER_HOUR) return true;
  noteAuthAttempt(key);
  return false;
}

export const FORUM_LOCKED_EDIT_ERROR = "Bu konu kilitli. Konu ve yorumlar düzenlenemez.";

export { FORUM_BODY_MAX, FORUM_POST_MAX, FORUM_TITLE_MAX, FORUM_TITLE_MIN };

export function getFanOfWeekHistory(teamId: string, limit?: number) {
  return queryFanOfWeekHistory(teamId, getDb(), limit);
}
