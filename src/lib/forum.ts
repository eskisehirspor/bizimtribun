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
  getCurrentForumLeaderUserId,
  getForumLeaderHistory as queryForumLeaderHistory,
  getMonthlyForumLeader as queryMonthlyForumLeader,
} from "./forum-leaders";
import { isPublicForumRow } from "./moderation/forum-gate";

export type ForumTeam = {
  id: string;
  name: string;
  league: string;
  is_forum_active: number;
};

export type ForumTopic = {
  id: number;
  team_id: string;
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
};

export type ForumAuthor = {
  id: number;
  username: string;
  isTribunLeader: boolean;
};

function authorOf(userId: number, leaderUserId: number | null): ForumAuthor | undefined {
  const row = getDb()
    .prepare(`SELECT id, username FROM users WHERE id = ?`)
    .get(userId) as { id: number; username: string } | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    isTribunLeader: leaderUserId != null && row.id === leaderUserId,
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

export function requireForumBoard(slug: string) {
  const team = findForumTeam(slug);
  if (!team || !team.is_forum_active) return undefined;
  return team;
}

const PUBLIC_LIVE = `deleted_at IS NULL AND held_at IS NULL`;

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
  teamId: string,
  offset: number,
  limit: number,
  opts?: { category?: ForumCategory | null; sort?: TopicSort },
) {
  const category = opts?.category ?? null;
  const sort: TopicSort = opts?.sort ?? "activity";
  const catSql = category ? `AND t.category = ?` : "";
  const countParams = category ? [teamId, category] : [teamId];
  const total = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM forum_topics t
         WHERE t.team_id = ? AND ${PUBLIC_LIVE} ${catSql}`,
      )
      .get(...countParams) as { c: number }
  ).c;

  const listParams = category
    ? [teamId, category, limit, offset]
    : [teamId, limit, offset];
  const rows = getDb()
    .prepare(
      `SELECT t.*, u.username,
              (SELECT COUNT(*) FROM forum_posts p
               WHERE p.topic_id = t.id AND p.deleted_at IS NULL AND p.held_at IS NULL) as post_count
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE t.team_id = ? AND t.deleted_at IS NULL AND t.held_at IS NULL ${catSql}
       ORDER BY ${topicOrderSql(sort)}
       LIMIT ? OFFSET ?`,
    )
    .all(...listParams) as (ForumTopic & {
    username: string;
    post_count: number;
  })[];

  const leaderUserId = getCurrentForumLeaderUserId(teamId, getDb());

  return {
    total,
    topics: rows.map((t) => ({
      id: t.id,
      teamId: t.team_id,
      title: t.title,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      lockedAt: t.locked_at,
      category: topicCategory(t.category),
      isPinned: Boolean(topicPinned(t.is_pinned)),
      postCount: t.post_count,
      author: {
        id: t.user_id,
        username: t.username,
        isTribunLeader: leaderUserId != null && t.user_id === leaderUserId,
      },
    })),
  };
}

export function listPosts(topicId: number, offset: number, limit: number) {
  const topic = findTopic(topicId);
  const leaderUserId = topic
    ? getCurrentForumLeaderUserId(topic.team_id, getDb())
    : null;
  const total = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM forum_posts
         WHERE topic_id = ? AND ${PUBLIC_LIVE}`,
      )
      .get(topicId) as { c: number }
  ).c;

  const rows = getDb()
    .prepare(
      `SELECT p.*, u.username
       FROM forum_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.topic_id = ? AND p.deleted_at IS NULL AND p.held_at IS NULL
       ORDER BY p.created_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(topicId, limit, offset) as (ForumPost & {
    username: string;
  })[];

  return {
    total,
    posts: rows.map((p) => ({
      id: p.id,
      topicId: p.topic_id,
      content: p.content,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      author: {
        id: p.user_id,
        username: p.username,
        isTribunLeader: leaderUserId != null && p.user_id === leaderUserId,
      },
    })),
  };
}

export function serializeTopic(topic: ForumTopic) {
  const leaderUserId = getCurrentForumLeaderUserId(topic.team_id, getDb());
  return {
    id: topic.id,
    teamId: topic.team_id,
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
  teamId: string;
  userId: number;
  title: string;
  content: string;
  category?: ForumCategory;
  holdForReview?: boolean;
}) {
  const now = new Date().toISOString();
  const heldAt = input.holdForReview ? now : null;
  const category = topicCategory(input.category ?? FORUM_CATEGORY_DEFAULT);
  const info = getDb()
    .prepare(
      `INSERT INTO forum_topics
       (team_id, user_id, title, content, created_at, updated_at, held_at, category, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      input.teamId,
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
  if (patch.category) {
    const result = getDb()
      .prepare(
        `UPDATE forum_topics
         SET title = ?, content = ?, category = ?, updated_at = ?, held_at = ?
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
      )
      .run(patch.title, patch.content, patch.category, now, heldAt, id, userId);
    return result.changes === 1;
  }
  const result = getDb()
    .prepare(
      `UPDATE forum_topics
       SET title = ?, content = ?, updated_at = ?, held_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
    )
    .run(patch.title, patch.content, now, heldAt, id, userId);
  return result.changes === 1;
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
  const result = getDb()
    .prepare(
      `UPDATE forum_posts
       SET content = ?, updated_at = ?, held_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
    )
    .run(content, now, heldAt, id, userId);
  return result.changes === 1;
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

export function serializePost(post: ForumPost) {
  const topic = findTopic(post.topic_id);
  const leaderUserId = topic
    ? getCurrentForumLeaderUserId(topic.team_id, getDb())
    : null;
  return {
    id: post.id,
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

export { FORUM_BODY_MAX, FORUM_POST_MAX, FORUM_TITLE_MAX, FORUM_TITLE_MIN };

export function getMonthlyForumLeader(teamId: string, year: number, month: number) {
  return queryMonthlyForumLeader(teamId, year, month, getDb());
}

export function getForumLeaderHistory(teamId: string, limit?: number) {
  return queryForumLeaderHistory(teamId, getDb(), limit);
}
