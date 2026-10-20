import type Database from "better-sqlite3";
import {
  FORUM_SYSTEM_EMAIL_DOMAIN,
  FORUM_SYSTEM_PASSWORD_HASH,
} from "./forum-system";

export type ForumLeader = {
  userId: number;
  /** Posts (replies) in the month, kept for older records and display. */
  postCount: number;
  /** Istanbul calendar days with at least one topic or reply. */
  activeDays: number;
  /** Likes received in the month from other members, at most 3 per liker. */
  likeCount: number;
  score: number;
  firstPostAt: string;
};

export type ForumLeaderPublic = {
  teamId: string;
  teamName: string;
  year: number;
  month: number;
  username: string;
  postCount: number;
  /** Null on records saved before leaders were picked by activity. */
  activeDays: number | null;
  likeCount: number | null;
};

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function formatForumLeaderPeriod(year: number, month: number) {
  return `${TR_MONTHS[month - 1] ?? month} ${year}`;
}

export function calendarMonthRange(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Geçersiz ay.");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${year}-${pad(month)}-01T00:00:00+03:00`);
  const end =
    month === 12
      ? new Date(`${year + 1}-01-01T00:00:00+03:00`)
      : new Date(`${year}-${pad(month + 1)}-01T00:00:00+03:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function currentCalendarMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

function isElapsedMonth(year: number, month: number, now = new Date()) {
  const cur = currentCalendarMonth(now);
  return year < cur.year || (year === cur.year && month < cur.month);
}

/** Active, not banned (expired bans allowed). System/seed accounts excluded. */
const ELIGIBLE_USER_SQL = `
  u.status = 'active'
  AND NOT (
    (u.status = 'banned' OR u.banned_at IS NOT NULL)
    AND (u.ban_expires_at IS NULL OR u.ban_expires_at > ?)
  )
  AND u.password_hash IS NOT ?
  AND (u.email_norm IS NULL OR u.email_norm NOT LIKE ?)
`;

function eligibleParams(nowIso: string) {
  return [nowIso, FORUM_SYSTEM_PASSWORD_HASH, `%${FORUM_SYSTEM_EMAIL_DOMAIN}`] as const;
}

/** Each active day weighs as much as this many likes. */
export const LEADER_DAY_WEIGHT = 3;
/** One member's likes count at most this many times for the same author. */
export const LEADER_LIKES_PER_LIKER = 3;

/**
 * Live leader for a team calendar month (Europe/Istanbul).
 * Rewards steady presence over flooding: score = active days × 3 + likes
 * received from other members (at most 3 from any one liker). Only public
 * topics and replies on that team's board count.
 */
export function getMonthlyForumLeader(
  teamId: string,
  year: number,
  month: number,
  db: Database.Database,
  nowIso = new Date().toISOString(),
): ForumLeader | null {
  const { startIso, endIso } = calendarMonthRange(year, month);
  const row = db
    .prepare(
      `WITH content AS (
         SELECT 'topic' AS type, t.id, t.user_id AS author, t.created_at, 0 AS is_post
         FROM forum_topics t
         WHERE t.team_id = ? AND t.deleted_at IS NULL AND t.held_at IS NULL
         UNION ALL
         SELECT 'post', p.id, p.user_id, p.created_at, 1
         FROM forum_posts p
         JOIN forum_topics t ON t.id = p.topic_id
         WHERE t.team_id = ? AND t.deleted_at IS NULL AND t.held_at IS NULL
           AND p.deleted_at IS NULL AND p.held_at IS NULL
       ),
       activity AS (
         SELECT author AS user_id,
                COUNT(DISTINCT date(created_at, '+3 hours')) AS activeDays,
                SUM(is_post) AS postCount,
                MIN(created_at) AS firstPostAt
         FROM content
         WHERE created_at >= ? AND created_at < ?
         GROUP BY author
       ),
       per_liker AS (
         SELECT c.author, MIN(COUNT(*), ?) AS n
         FROM forum_likes l
         JOIN content c ON c.type = l.target_type AND c.id = l.target_id
         JOIN users lu ON lu.id = l.user_id
         WHERE l.user_id != c.author
           AND l.created_at >= ? AND l.created_at < ?
           AND lu.status = 'active'
         GROUP BY c.author, l.user_id
       ),
       likes AS (SELECT author, SUM(n) AS likeCount FROM per_liker GROUP BY author)
       SELECT a.user_id AS userId, a.activeDays, a.postCount, a.firstPostAt,
              COALESCE(k.likeCount, 0) AS likeCount,
              a.activeDays * ? + COALESCE(k.likeCount, 0) AS score
       FROM activity a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN likes k ON k.author = a.user_id
       WHERE ${ELIGIBLE_USER_SQL}
       ORDER BY score DESC, a.activeDays DESC, a.firstPostAt ASC, a.user_id ASC
       LIMIT 1`,
    )
    .get(
      teamId,
      teamId,
      startIso,
      endIso,
      LEADER_LIKES_PER_LIKER,
      startIso,
      endIso,
      LEADER_DAY_WEIGHT,
      ...eligibleParams(nowIso),
    ) as ForumLeader | undefined;

  if (!row || row.activeDays < 1) return null;
  return {
    userId: row.userId,
    postCount: row.postCount,
    activeDays: row.activeDays,
    likeCount: row.likeCount,
    score: row.score,
    firstPostAt: row.firstPostAt,
  };
}

export function saveForumLeader(
  teamId: string,
  year: number,
  month: number,
  db: Database.Database,
  nowIso = new Date().toISOString(),
) {
  const leader = getMonthlyForumLeader(teamId, year, month, db, nowIso);
  if (!leader) return { saved: false as const, leader: null };
  const created = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO forum_leaders
       (team_id, user_id, year, month, post_count, active_days, like_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(teamId, leader.userId, year, month, leader.postCount, leader.activeDays, leader.likeCount, created);
  return { saved: info.changes === 1, leader };
}

export function recordElapsedForumLeader(
  teamId: string,
  year: number,
  month: number,
  db: Database.Database,
  now = new Date(),
) {
  if (!isElapsedMonth(year, month, now)) return { saved: false as const, leader: null };
  return saveForumLeader(teamId, year, month, db, now.toISOString());
}

export function recordRecentElapsedForumLeaders(
  teamId: string,
  db: Database.Database,
  now = new Date(),
) {
  const cur = currentCalendarMonth(now);
  let year = cur.year;
  let month = cur.month;
  for (let i = 0; i < 24; i++) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    recordElapsedForumLeader(teamId, year, month, db, now);
  }
}

export function getCurrentForumLeaderUserId(
  teamId: string,
  db: Database.Database,
  now = new Date(),
) {
  recordRecentElapsedForumLeaders(teamId, db, now);
  const { year, month } = currentCalendarMonth(now);
  return getMonthlyForumLeader(teamId, year, month, db, now.toISOString())?.userId ?? null;
}

export function getForumLeaderHistory(
  teamId: string,
  db: Database.Database,
  limit = 12,
  now = new Date(),
): ForumLeaderPublic[] {
  const take = Math.min(36, Math.max(1, limit));
  recordRecentElapsedForumLeaders(teamId, db, now);
  const rows = db
    .prepare(
      `SELECT l.team_id as teamId, t.name as teamName, l.year, l.month,
              u.username as username, l.post_count as postCount,
              l.active_days as activeDays, l.like_count as likeCount
       FROM forum_leaders l
       JOIN teams t ON t.id = l.team_id
       JOIN users u ON u.id = l.user_id
       WHERE l.team_id = ?
       ORDER BY l.year DESC, l.month DESC
       LIMIT ?`,
    )
    .all(teamId, take) as ForumLeaderPublic[];
  return rows;
}
