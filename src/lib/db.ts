import Database from "better-sqlite3";
import { identityEmailHash, identityPhoneHash } from "./crypto";
import { CURRENT_POLL_ID } from "./policy";
import { applyDemoVotes } from "./seed-votes";
import { seedPinnedStarterTopics } from "./forum-seed";
import { FORUM_ACTIVE_TEAM_IDS, TEAMS } from "./teams";
import {
  backfillVotesFromParticipants,
  revokeVotesMissingPhoneVerification,
} from "./votes";
import {
  ensureSqliteParentDir,
  isProductionDbRuntime,
  resolveSqlitePath,
} from "./db-path";
import { sqliteQuickCheck } from "./db-health";

let singleton: Database.Database | undefined;

function openDb() {
  const sqlitePath = resolveSqlitePath();
  ensureSqliteParentDir(sqlitePath);
  const db = new Database(sqlitePath);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    applyDatabaseBoot(db);
    if (isProductionDbRuntime() && !sqliteQuickCheck(db)) {
      throw new Error("DB_UNHEALTHY");
    }
    return db;
  } catch (err) {
    try {
      db.close();
    } catch {
      /* ignore close after failed boot */
    }
    throw err;
  }
}

export function applyDatabaseBoot(db: Database.Database) {

db.exec(`
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL,
  city TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS verify_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS ip_locks (
  ip_hash TEXT PRIMARY KEY,
  last_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS register_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_verified ON participants(verified_at);
CREATE INDEX IF NOT EXISTS idx_attempts_ip ON register_attempts(ip_hash, created_at);
`);

const participantCols = (
  db.prepare(`PRAGMA table_info(participants)`).all() as { name: string }[]
).map((c) => c.name);
if (!participantCols.includes("first_name")) {
  db.exec(`ALTER TABLE participants ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`);
}
if (!participantCols.includes("last_name")) {
  db.exec(`ALTER TABLE participants ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`);
}
if (!participantCols.includes("phone")) {
  db.exec(`ALTER TABLE participants ADD COLUMN phone TEXT NOT NULL DEFAULT ''`);
}
if (!participantCols.includes("phone_norm")) {
  db.exec(`ALTER TABLE participants ADD COLUMN phone_norm TEXT NOT NULL DEFAULT ''`);
}
if (!participantCols.includes("email_hash")) {
  db.exec(`ALTER TABLE participants ADD COLUMN email_hash TEXT`);
}
if (!participantCols.includes("phone_hash")) {
  db.exec(`ALTER TABLE participants ADD COLUMN phone_hash TEXT`);
}
if (!participantCols.includes("phone_verified_at")) {
  db.exec(`ALTER TABLE participants ADD COLUMN phone_verified_at TEXT`);
}

const needHashBackfill = db
  .prepare(
    `SELECT id, email_norm, phone_norm, email_hash, phone_hash
     FROM participants
     WHERE (email_hash IS NULL OR phone_hash IS NULL)`,
  )
  .all() as {
  id: number;
  email_norm: string;
  phone_norm: string;
  email_hash: string | null;
  phone_hash: string | null;
}[];

for (const row of needHashBackfill) {
  const emailOk =
    row.email_norm && !row.email_norm.startsWith("deleted:");
  const phoneOk =
    row.phone_norm &&
    !row.phone_norm.startsWith("deleted:") &&
    row.phone_norm.length >= 10;

  const emailHash =
    row.email_hash || (emailOk ? identityEmailHash(row.email_norm) : null);
  let phoneHash =
    row.phone_hash || (phoneOk ? identityPhoneHash(row.phone_norm) : null);

  if (phoneHash) {
    const clash = db
      .prepare(
        `SELECT id FROM participants WHERE phone_hash = ? AND id != ? LIMIT 1`,
      )
      .get(phoneHash, row.id) as { id: number } | undefined;
    if (clash) phoneHash = row.phone_hash;
  }

  db.prepare(
    `UPDATE participants SET email_hash = ?, phone_hash = ? WHERE id = ?`,
  ).run(emailHash, phoneHash, row.id);
}

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_email_hash
  ON participants(email_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_phone_hash
  ON participants(phone_hash);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  poll_id TEXT NOT NULL REFERENCES polls(id),
  team_id TEXT NOT NULL,
  city TEXT NOT NULL,
  cast_at TEXT NOT NULL,
  revoked_at TEXT
);
`);

db.prepare(
  `INSERT OR IGNORE INTO polls (id, title, created_at) VALUES (?, ?, ?)`,
).run(CURRENT_POLL_ID, "Türkiye tribün sayımı", new Date().toISOString());

db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_participant_poll
  ON votes(participant_id, poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_live_poll
  ON votes(poll_id, revoked_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS vote_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vote_grants_participant
  ON vote_grants(participant_id, expires_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS phone_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  consumed_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_phone_otps_participant
  ON phone_otps(participant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone
  ON phone_otps(phone_hash, created_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  is_forum_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_norm TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  banned_at TEXT,
  ban_reason TEXT,
  ban_expires_at TEXT,
  participant_id INTEGER UNIQUE REFERENCES participants(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  birth_date TEXT,
  phone TEXT,
  phone_norm TEXT,
  city TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  totp_secret_enc TEXT,
  email_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
`);

const userCols = (
  db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
).map((c) => c.name);
if (!userCols.includes("role")) {
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
}
const userColsAfterRole = (
  db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
).map((c) => c.name);
const userProfileCols: Array<[string, string]> = [
  ["first_name", "TEXT"],
  ["last_name", "TEXT"],
  ["birth_date", "TEXT"],
  ["phone", "TEXT"],
  ["phone_norm", "TEXT"],
  ["city", "TEXT"],
];
for (const [name, type] of userProfileCols) {
  if (!userColsAfterRole.includes(name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
}
if (!userColsAfterRole.includes("totp_enabled")) {
  db.exec(
    `ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`,
  );
}
if (!userColsAfterRole.includes("totp_secret_enc")) {
  db.exec(`ALTER TABLE users ADD COLUMN totp_secret_enc TEXT`);
}
if (!userColsAfterRole.includes("email_verified_at")) {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT`);
}
db.exec(`
CREATE TABLE IF NOT EXISTS user_email_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_email_tokens_user
  ON user_email_tokens(user_id, created_at);
`);
const sessionCols = (
  db.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[]
).map((c) => c.name);
if (!sessionCols.includes("last_seen_at")) {
  db.exec(`ALTER TABLE sessions ADD COLUMN last_seen_at TEXT`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_norm
   ON users(phone_norm) WHERE phone_norm IS NOT NULL`,
);

const teamCols = (
  db.prepare(`PRAGMA table_info(teams)`).all() as { name: string }[]
).map((c) => c.name);
if (!teamCols.includes("is_forum_active")) {
  db.exec(
    `ALTER TABLE teams ADD COLUMN is_forum_active INTEGER NOT NULL DEFAULT 0`,
  );
}

db.exec(`
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  locked_at TEXT,
  deleted_at TEXT,
  held_at TEXT,
  category TEXT NOT NULL DEFAULT 'gundem',
  is_pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES forum_topics(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_forum_topics_team_created
  ON forum_topics(team_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic_created
  ON forum_posts(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_topics_user
  ON forum_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user
  ON forum_posts(user_id);
`);

const forumTopicCols = (
  db.prepare(`PRAGMA table_info(forum_topics)`).all() as { name: string }[]
).map((c) => c.name);
if (!forumTopicCols.includes("held_at")) {
  db.exec(`ALTER TABLE forum_topics ADD COLUMN held_at TEXT`);
}
if (!forumTopicCols.includes("category")) {
  db.exec(
    `ALTER TABLE forum_topics ADD COLUMN category TEXT NOT NULL DEFAULT 'gundem'`,
  );
}
if (!forumTopicCols.includes("is_pinned")) {
  db.exec(
    `ALTER TABLE forum_topics ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`,
  );
}
db.exec(
  `UPDATE forum_topics SET category = 'gundem' WHERE category IS NULL OR trim(category) = ''`,
);
db.exec(`
CREATE INDEX IF NOT EXISTS idx_forum_topics_team_cat_pin
  ON forum_topics(team_id, category, is_pinned, updated_at);
`);
const forumPostCols = (
  db.prepare(`PRAGMA table_info(forum_posts)`).all() as { name: string }[]
).map((c) => c.name);
if (!forumPostCols.includes("held_at")) {
  db.exec(`ALTER TABLE forum_posts ADD COLUMN held_at TEXT`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS forum_leaders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  post_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (team_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_forum_leaders_team_period
  ON forum_leaders(team_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_forum_leaders_user
  ON forum_leaders(user_id);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS team_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  city_slug TEXT NOT NULL,
  message TEXT NOT NULL,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_user_id INTEGER REFERENCES users(id),
  review_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_team_requests_status_created
  ON team_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_team_requests_normalized_status
  ON team_requests(normalized_name, status);
CREATE INDEX IF NOT EXISTS idx_team_requests_user
  ON team_requests(requested_by_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_team_requests_city_status
  ON team_requests(city_slug, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_requests_user_pending
  ON team_requests(requested_by_user_id, normalized_name)
  WHERE status = 'pending';
`);

db.exec(`
CREATE TABLE IF NOT EXISTS moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moderator_user_id INTEGER NOT NULL REFERENCES users(id),
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_topic_id INTEGER REFERENCES forum_topics(id) ON DELETE SET NULL,
  target_post_id INTEGER REFERENCES forum_posts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_moderator_created
  ON moderation_actions(moderator_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_target_user
  ON moderation_actions(target_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_target_topic
  ON moderation_actions(target_topic_id);
CREATE INDEX IF NOT EXISTS idx_moderation_target_post
  ON moderation_actions(target_post_id);
CREATE INDEX IF NOT EXISTS idx_moderation_action_created
  ON moderation_actions(action, created_at);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS admin_totp_setup (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_recovery_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_recovery_user
  ON admin_recovery_codes(user_id, used_at);

CREATE TABLE IF NOT EXISTS admin_login_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_user
  ON admin_login_challenges(user_id, expires_at);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  success INTEGER NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON security_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_action_created
  ON security_events(action, created_at);
`);

const upsertTeam = db.prepare(
  `INSERT INTO teams (id, name, league, is_forum_active) VALUES (?, ?, ?, 0)
   ON CONFLICT(id) DO UPDATE SET name = excluded.name, league = excluded.league`,
);
const syncTeams = db.transaction(() => {
  for (const team of TEAMS) {
    upsertTeam.run(team.id, team.name, team.league);
  }
  db.prepare(`UPDATE teams SET is_forum_active = 0`).run();
  const activate = db.prepare(`UPDATE teams SET is_forum_active = 1 WHERE id = ?`);
  for (const id of FORUM_ACTIVE_TEAM_IDS) activate.run(id);
});
syncTeams();
seedPinnedStarterTopics(db);

revokeVotesMissingPhoneVerification(db);
backfillVotesFromParticipants(db);
applyDemoVotes(db);
}

export function resetDbForTests() {
  if (process.env.BIZIM_TRIBUN_TEST !== "1") {
    throw new Error("resetDbForTests is test-only");
  }
  if (singleton) {
    try {
      singleton.close();
    } catch {
      /* already closed */
    }
    singleton = undefined;
  }
}

export type Participant = {
  id: number;
  email: string;
  email_norm: string;
  team_id: string;
  city: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_norm: string;
  email_hash: string | null;
  phone_hash: string | null;
  ip_hash: string;
  fingerprint_hash: string;
  consent_version: string;
  consent_at: string;
  created_at: string;
  verified_at: string | null;
  phone_verified_at: string | null;
  deleted_at: string | null;
};

export function getDb() {
  if (!singleton) singleton = openDb();
  return singleton;
}
