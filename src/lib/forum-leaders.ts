import type Database from "better-sqlite3";
import {
  FORUM_SYSTEM_EMAIL_DOMAIN,
  FORUM_SYSTEM_PASSWORD_HASH,
} from "./forum-system";

export type FanOfWeek = {
  userId: number;
  /** Replies in the week. */
  postCount: number;
  /** Istanbul calendar days with at least one topic or reply (at most 7). */
  activeDays: number;
  /** Likes received in the week from other members, at most 3 per liker. */
  likeCount: number;
  score: number;
  firstPostAt: string;
};

export type FanOfWeekPublic = {
  teamId: string;
  teamName: string;
  weekStart: string;
  username: string;
  activeDays: number;
  likeCount: number;
};

const TR_MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Istanbul is UTC+3 all year. */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Monday (Istanbul) of the week `now` falls in, as YYYY-MM-DD. */
export function weekStartOf(now = new Date()) {
  const local = new Date(now.getTime() + TR_OFFSET_MS);
  const back = (local.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back));
  return monday.toISOString().slice(0, 10);
}

/** UTC bounds of the Istanbul week starting on `weekStart` (Monday 00:00 to the next Monday). */
export function weekRange(weekStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error("Geçersiz hafta.");
  const start = new Date(`${weekStart}T00:00:00+03:00`);
  if (Number.isNaN(start.getTime())) throw new Error("Geçersiz hafta.");
  return { startIso: start.toISOString(), endIso: new Date(start.getTime() + WEEK_MS).toISOString() };
}

export function previousWeekStart(weekStart: string) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return new Date(d.getTime() - WEEK_MS).toISOString().slice(0, 10);
}

/** "13–19 Eki 2026", or "29 Eyl – 5 Eki 2026" across months. */
export function formatWeek(weekStart: string) {
  const a = new Date(`${weekStart}T00:00:00Z`);
  const b = new Date(a.getTime() + 6 * DAY_MS);
  const mon = (d: Date) => TR_MONTHS_SHORT[d.getUTCMonth()];
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${mon(b)} ${b.getUTCFullYear()}`;
  }
  const yearA = a.getUTCFullYear() === b.getUTCFullYear() ? "" : ` ${a.getUTCFullYear()}`;
  return `${a.getUTCDate()} ${mon(a)}${yearA} – ${b.getUTCDate()} ${mon(b)} ${b.getUTCFullYear()}`;
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
 * "Haftanın Taraftarı" of a team for one Istanbul week (Monday to Sunday).
 * Rewards steady presence over flooding: score = active days × 3 + likes
 * received from other members (at most 3 from any one liker). Only public
 * topics and replies on that team's board count.
 */
export function getWeeklyFanOfWeek(
  teamId: string,
  weekStart: string,
  db: Database.Database,
  nowIso = new Date().toISOString(),
): FanOfWeek | null {
  const { startIso, endIso } = weekRange(weekStart);
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
    ) as FanOfWeek | undefined;

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

/** Stores the winner of a finished week once; later calls leave it as is. */
export function saveFanOfWeek(
  teamId: string,
  weekStart: string,
  db: Database.Database,
  nowIso = new Date().toISOString(),
) {
  const winner = getWeeklyFanOfWeek(teamId, weekStart, db, nowIso);
  if (!winner) return { saved: false as const, winner: null };
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO fan_of_week
       (team_id, user_id, week_start, post_count, active_days, like_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(teamId, winner.userId, weekStart, winner.postCount, winner.activeDays, winner.likeCount, nowIso);
  return { saved: info.changes === 1, winner };
}

/** Records the winners of the last 12 finished weeks that are not stored yet. */
export function recordRecentFansOfWeek(teamId: string, db: Database.Database, now = new Date()) {
  let week = weekStartOf(now);
  for (let i = 0; i < 12; i++) {
    week = previousWeekStart(week);
    saveFanOfWeek(teamId, week, db, now.toISOString());
  }
}

/**
 * Who wears the torch this week: the winner of last week. Picked once the
 * week is over, so it can't change while people are still posting.
 */
export function getCurrentFanOfWeekUserId(teamId: string, db: Database.Database, now = new Date()) {
  const lastWeek = previousWeekStart(weekStartOf(now));
  saveFanOfWeek(teamId, lastWeek, db, now.toISOString());
  const row = db
    .prepare(`SELECT user_id FROM fan_of_week WHERE team_id = ? AND week_start = ?`)
    .get(teamId, lastWeek) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export function getFanOfWeekHistory(
  teamId: string,
  db: Database.Database,
  limit = 8,
  now = new Date(),
): FanOfWeekPublic[] {
  const take = Math.min(26, Math.max(1, limit));
  recordRecentFansOfWeek(teamId, db, now);
  return db
    .prepare(
      `SELECT w.team_id as teamId, t.name as teamName, w.week_start as weekStart,
              u.username as username, w.active_days as activeDays, w.like_count as likeCount
       FROM fan_of_week w
       JOIN teams t ON t.id = w.team_id
       JOIN users u ON u.id = w.user_id
       WHERE w.team_id = ?
       ORDER BY w.week_start DESC
       LIMIT ?`,
    )
    .all(teamId, take) as FanOfWeekPublic[];
}
