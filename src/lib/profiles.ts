import type Database from "better-sqlite3";
import { notify } from "./notifications";

/**
 * Member profiles, badges and contribution points (XP).
 *
 * Badges and XP only describe forum participation. They never touch
 * fan_votes, team counts or rankings, and supporting a big team gives no XP.
 * Everything is computed from live (not removed, not held) content, so a
 * moderator removing spam also removes the points it would have earned.
 */

import { AVATARS, PROFILE_BIO_MAX, PROFILE_DISPLAY_NAME_MAX, type AvatarKey } from "./profile-options";

export { AVATAR_EMOJI, AVATARS, PROFILE_BIO_MAX, PROFILE_DISPLAY_NAME_MAX, type AvatarKey } from "./profile-options";

export type ProfileVisibility = "members" | "public";

export const BADGES = {
  ilk_konu: { label: "İlk Konu", description: "Tribünde ilk konusunu açtı." },
  ilk_yorum: { label: "İlk Yorum", description: "Tribüne ilk yorumunu yazdı." },
  faydali: {
    label: "Faydalı Katkı",
    description: "Yazıları en az 5 farklı üyeden toplam 10 beğeni aldı.",
  },
  nitelikli: {
    label: "Nitelikli Katkı",
    description: "En az 25 yazısı başka bir üye tarafından beğenildi.",
  },
  duzenli: {
    label: "Düzenli Taraftar",
    description: "En az 4 farklı haftada tribüne katkı verdi.",
  },
} as const;
export type BadgeKey = keyof typeof BADGES;
export const BADGE_KEYS = Object.keys(BADGES) as BadgeKey[];

/** XP from writing is capped per day so flooding the forum earns nothing extra. */
export const XP_TOPIC = 3;
export const XP_POST = 1;
export const XP_WRITING_DAILY_CAP = 10;
export const XP_PER_LIKE = 2;

export const LEVELS = [
  { min: 0, label: "Taraftar" },
  { min: 50, label: "Tribün Sesi" },
  { min: 200, label: "Kale Arkası" },
  { min: 500, label: "Amigo" },
] as const;

export function levelFor(xp: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = null;
  for (const level of LEVELS) {
    if (xp >= level.min) current = level;
    else {
      next = level;
      break;
    }
  }
  return { label: current.label, min: current.min, next: next ? { label: next.label, min: next.min } : null };
}

// Live content on an open board: not removed, not held, and the team board
// (when it is one) still active.
const LIVE_TOPIC = `t.deleted_at IS NULL AND t.held_at IS NULL
  AND (t.board != 'team' OR EXISTS (SELECT 1 FROM teams tm WHERE tm.id = t.team_id AND tm.is_forum_active = 1))`;
const LIVE_POST = `p.deleted_at IS NULL AND p.held_at IS NULL`;

type Stats = {
  topics: number;
  posts: number;
  likesReceived: number;
  distinctLikers: number;
  likedItems: number;
  activeWeeks: number;
  writingXp: number;
};

/** Likes from other members on the user's live topics and posts. */
const LIKES_ON_USER = `
  SELECT l.user_id as liker, l.target_type || ':' || l.target_id as item
  FROM forum_likes l
  JOIN forum_topics t ON l.target_type = 'topic' AND t.id = l.target_id
  WHERE t.user_id = @uid AND l.user_id != @uid AND ${LIVE_TOPIC}
  UNION ALL
  SELECT l.user_id as liker, l.target_type || ':' || l.target_id as item
  FROM forum_likes l
  JOIN forum_posts p ON l.target_type = 'post' AND p.id = l.target_id
  JOIN forum_topics t ON t.id = p.topic_id
  WHERE p.user_id = @uid AND l.user_id != @uid AND ${LIVE_POST} AND ${LIVE_TOPIC}`;

export function contributionStats(db: Database.Database, userId: number): Stats {
  const uid = { uid: userId };
  const topics = (
    db.prepare(`SELECT COUNT(*) as c FROM forum_topics t WHERE t.user_id = @uid AND ${LIVE_TOPIC}`).get(uid) as {
      c: number;
    }
  ).c;
  const posts = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM forum_posts p JOIN forum_topics t ON t.id = p.topic_id
         WHERE p.user_id = @uid AND ${LIVE_POST} AND ${LIVE_TOPIC}`,
      )
      .get(uid) as { c: number }
  ).c;
  const likes = db
    .prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT liker) as likers, COUNT(DISTINCT item) as items FROM (${LIKES_ON_USER})`,
    )
    .get(uid) as { total: number; likers: number; items: number };
  const days = db
    .prepare(
      `SELECT day, SUM(xp) as xp FROM (
         SELECT substr(t.created_at, 1, 10) as day, ${XP_TOPIC} as xp
         FROM forum_topics t WHERE t.user_id = @uid AND ${LIVE_TOPIC}
         UNION ALL
         SELECT substr(p.created_at, 1, 10) as day, ${XP_POST} as xp
         FROM forum_posts p JOIN forum_topics t ON t.id = p.topic_id
         WHERE p.user_id = @uid AND ${LIVE_POST} AND ${LIVE_TOPIC}
       ) GROUP BY day`,
    )
    .all(uid) as { day: string; xp: number }[];
  const weeks = new Set(days.map((d) => isoWeek(d.day)));
  return {
    topics,
    posts,
    likesReceived: likes.total,
    distinctLikers: likes.likers,
    likedItems: likes.items,
    activeWeeks: weeks.size,
    writingXp: days.reduce((sum, d) => sum + Math.min(XP_WRITING_DAILY_CAP, d.xp), 0),
  };
}

function isoWeek(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${week}`;
}

export function xpFromStats(s: Stats) {
  return s.writingXp + s.likesReceived * XP_PER_LIKE;
}

export function earnedBadges(s: Stats): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (s.topics >= 1) out.push("ilk_konu");
  if (s.posts >= 1) out.push("ilk_yorum");
  if (s.likesReceived >= 10 && s.distinctLikers >= 5) out.push("faydali");
  if (s.likedItems >= 25) out.push("nitelikli");
  if (s.activeWeeks >= 4) out.push("duzenli");
  return out;
}

/**
 * Awards any newly earned badge (once; badges are kept even if later content
 * is removed) and sends one in-site notification per badge.
 */
export function refreshBadges(db: Database.Database, userId: number) {
  const user = db.prepare(`SELECT id FROM users WHERE id = ? AND deleted_at IS NULL`).get(userId);
  if (!user) return [];
  const earned = earnedBadges(contributionStats(db, userId));
  const insert = db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge, awarded_at) VALUES (?, ?, ?)`);
  const now = new Date().toISOString();
  const fresh: BadgeKey[] = [];
  for (const badge of earned) {
    if (insert.run(userId, badge, now).changes === 1) {
      fresh.push(badge);
      notify(db, {
        userId,
        kind: "badge",
        body: `Yeni rozet: ${BADGES[badge].label}. ${BADGES[badge].description}`,
        dedupeKey: `badge:${badge}`,
      });
    }
  }
  return fresh;
}

export function listBadges(db: Database.Database, userId: number) {
  return (
    db
      .prepare(`SELECT badge, awarded_at as awardedAt FROM user_badges WHERE user_id = ? ORDER BY awarded_at, badge`)
      .all(userId) as { badge: string; awardedAt: string }[]
  )
    .filter((b): b is { badge: BadgeKey; awardedAt: string } => b.badge in BADGES)
    .map((b) => ({ key: b.badge, ...BADGES[b.badge], awardedAt: b.awardedAt }));
}

type ProfileRow = {
  id: number;
  username: string;
  display_name: string;
  username_norm: string;
  bio: string | null;
  avatar: string | null;
  profile_visibility: ProfileVisibility;
  show_city: number;
  city: string | null;
  role: string;
  status: string;
  created_at: string;
  team_id: string | null;
  vote_team: string | null;
  deleted_at: string | null;
  banned_at: string | null;
};

function findProfileRow(db: Database.Database, username: string) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.username_norm, u.display_name, u.bio, u.avatar, u.profile_visibility,
              u.show_city, u.city, u.role, u.status, u.created_at, u.team_id, u.deleted_at, u.banned_at,
              (SELECT fv.team_id FROM fan_votes fv WHERE fv.user_id = u.id AND fv.status = 'active') as vote_team
       FROM users u WHERE u.username_norm = ?`,
    )
    .get(username.trim().toLowerCase()) as ProfileRow | undefined;
}

export type PublicProfile = {
  id: number;
  username: string;
  /** Only when the member set one different from the username. */
  displayName: string | null;
  bio: string | null;
  avatar: AvatarKey | null;
  teamId: string | null;
  province: string | null;
  memberSince: string;
  role: string;
  visibility: ProfileVisibility;
  badges: ReturnType<typeof listBadges>;
  xp: number;
  level: ReturnType<typeof levelFor>;
  counts: { topics: number; posts: number; likesReceived: number };
};

/**
 * The profile as another member (or a visitor) may see it. Never includes
 * phone, e-mail, real name, birth date or verification details. A
 * members-only profile is not shown to signed-out visitors.
 */
export function getPublicProfile(
  db: Database.Database,
  username: string,
  viewer: { signedIn: boolean },
): { ok: true; profile: PublicProfile } | { ok: false; status: 404 | 403; error: string } {
  const row = findProfileRow(db, username);
  if (!row || row.deleted_at || row.status === "deleted") {
    return { ok: false, status: 404, error: "Üye bulunamadı." };
  }
  if (row.profile_visibility !== "public" && !viewer.signedIn) {
    return { ok: false, status: 403, error: "Bu profil yalnızca üyelere açık." };
  }
  const stats = contributionStats(db, row.id);
  const xp = xpFromStats(stats);
  const display = row.display_name?.trim();
  return {
    ok: true,
    profile: {
      id: row.id,
      username: row.username,
      displayName: display && display.toLowerCase() !== row.username_norm ? display : null,
      bio: row.bio,
      avatar: (AVATARS as readonly string[]).includes(row.avatar ?? "") ? (row.avatar as AvatarKey) : null,
      teamId: row.vote_team ?? row.team_id,
      province: row.show_city ? row.city : null,
      memberSince: row.created_at,
      role: row.role,
      visibility: row.profile_visibility,
      badges: listBadges(db, row.id),
      xp,
      level: levelFor(xp),
      counts: { topics: stats.topics, posts: stats.posts, likesReceived: stats.likesReceived },
    },
  };
}

export type ProfileActivityItem = {
  type: "topic" | "post";
  id: number;
  topicId: number;
  title: string;
  excerpt: string;
  createdAt: string;
};

/** The member's live topics and replies on open boards, newest first. */
export function listProfileActivity(db: Database.Database, userId: number, offset: number, limit: number) {
  const params = { uid: userId, limit, offset };
  const items = db
    .prepare(
      `SELECT * FROM (
         SELECT 'topic' as type, t.id as id, t.id as topicId, t.title as title,
                substr(t.content, 1, 200) as excerpt, t.created_at as createdAt
         FROM forum_topics t WHERE t.user_id = @uid AND ${LIVE_TOPIC}
         UNION ALL
         SELECT 'post' as type, p.id as id, t.id as topicId, t.title as title,
                substr(p.content, 1, 200) as excerpt, p.created_at as createdAt
         FROM forum_posts p JOIN forum_topics t ON t.id = p.topic_id
         WHERE p.user_id = @uid AND ${LIVE_POST} AND ${LIVE_TOPIC}
       ) ORDER BY createdAt DESC, type, id DESC LIMIT @limit OFFSET @offset`,
    )
    .all(params) as ProfileActivityItem[];
  return items;
}

export type ProfileSettings = {
  displayName: string;
  bio: string;
  avatar: AvatarKey | null;
  visibility: ProfileVisibility;
  showCity: boolean;
  notifyReplies: boolean;
  notifyMentions: boolean;
  notifyLikes: boolean;
};

export function getProfileSettings(db: Database.Database, userId: number): ProfileSettings | null {
  const row = db
    .prepare(
      `SELECT display_name, username_norm, bio, avatar, profile_visibility, show_city,
              notify_replies, notify_mentions, notify_likes
       FROM users WHERE id = ? AND deleted_at IS NULL`,
    )
    .get(userId) as
    | {
        display_name: string;
        username_norm: string;
        bio: string | null;
        avatar: string | null;
        profile_visibility: ProfileVisibility;
        show_city: number;
        notify_replies: number;
        notify_mentions: number;
        notify_likes: number;
      }
    | undefined;
  if (!row) return null;
  return {
    displayName: row.display_name.toLowerCase() === row.username_norm ? "" : row.display_name,
    bio: row.bio ?? "",
    avatar: (AVATARS as readonly string[]).includes(row.avatar ?? "") ? (row.avatar as AvatarKey) : null,
    visibility: row.profile_visibility,
    showCity: Boolean(row.show_city),
    notifyReplies: Boolean(row.notify_replies),
    notifyMentions: Boolean(row.notify_mentions),
    notifyLikes: Boolean(row.notify_likes),
  };
}

const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Updates what a member may change on their own profile. Username, team and
 * province (the vote's province) are not editable here; role and status
 * cannot be reached from this function at all.
 */
export function updateProfileSettings(
  db: Database.Database,
  userId: number,
  input: Partial<ProfileSettings>,
): { ok: true; settings: ProfileSettings } | { ok: false; error: string; status: number } {
  const current = getProfileSettings(db, userId);
  if (!current) return { ok: false, error: "Hesap bulunamadı.", status: 404 };
  const next = { ...current, ...input };
  const displayName = oneLine(next.displayName ?? "").slice(0, PROFILE_DISPLAY_NAME_MAX);
  const bio = (next.bio ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, PROFILE_BIO_MAX);
  if (next.avatar != null && !(AVATARS as readonly string[]).includes(next.avatar)) {
    return { ok: false, error: "Geçersiz avatar.", status: 400 };
  }
  if (next.visibility !== "members" && next.visibility !== "public") {
    return { ok: false, error: "Geçersiz görünürlük.", status: 400 };
  }
  const username = (db.prepare(`SELECT username_norm FROM users WHERE id = ?`).get(userId) as { username_norm: string })
    .username_norm;
  db.prepare(
    `UPDATE users SET display_name = ?, bio = ?, avatar = ?, profile_visibility = ?, show_city = ?,
       notify_replies = ?, notify_mentions = ?, notify_likes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    displayName || username,
    bio || null,
    next.avatar ?? null,
    next.visibility,
    next.showCity ? 1 : 0,
    next.notifyReplies ? 1 : 0,
    next.notifyMentions ? 1 : 0,
    next.notifyLikes ? 1 : 0,
    new Date().toISOString(),
    userId,
  );
  return { ok: true, settings: getProfileSettings(db, userId)! };
}
