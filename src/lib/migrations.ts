import type Database from "better-sqlite3";
import { LEAGUE_LABEL, LEAGUE_ORDER } from "./teams";

/**
 * Ordered, run-once schema migrations.
 *
 * `applyDatabaseBoot` keeps the historical idempotent baseline (CREATE IF NOT
 * EXISTS / ADD COLUMN). Everything after that baseline lives here: each entry
 * runs exactly once, inside a transaction, and is recorded in
 * `schema_migrations`. Never edit or reorder a shipped migration; add a new one.
 */
export type Migration = {
  id: string;
  /** Table rebuilds need foreign_keys=OFF, which SQLite only allows outside a transaction. */
  rebuildsTables?: boolean;
  up(db: Database.Database): void;
};

const USER_COLUMNS = [
  "id",
  "username",
  "username_norm",
  "display_name",
  "email",
  "email_norm",
  "password_hash",
  "team_id",
  "status",
  "role",
  "created_at",
  "updated_at",
  "last_login_at",
  "banned_at",
  "ban_reason",
  "ban_expires_at",
  "participant_id",
  "first_name",
  "last_name",
  "birth_date",
  "phone",
  "phone_norm",
  "city",
  "totp_enabled",
  "totp_secret_enc",
  "email_verified_at",
];

export const USER_ROLE_VALUES = ["user", "moderator", "admin", "super_admin"];
export const USER_STATUS_VALUES = ["active", "banned", "deleted"];

const sqlList = (values: string[]) => values.map((v) => `'${v}'`).join(", ");

export const MIGRATIONS: Migration[] = [
  {
    id: "001_phone_accounts_and_fan_votes",
    rebuildsTables: true,
    up(db) {
      // 1. users: email/password become optional (phone OTP accounts), roles and
      //    statuses get CHECK constraints, phone verification + soft delete added.
      const copyCols = USER_COLUMNS.filter((c) => c !== "status" && c !== "role");
      db.exec(`
CREATE TABLE users_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_norm TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email TEXT,
  email_norm TEXT UNIQUE,
  password_hash TEXT,
  team_id TEXT REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (${sqlList(USER_STATUS_VALUES)})),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN (${sqlList(USER_ROLE_VALUES)})),
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
  email_verified_at TEXT,
  phone_verified_at TEXT,
  deleted_at TEXT,
  terms_version TEXT,
  terms_accepted_at TEXT
);
INSERT INTO users_v2 (${copyCols.join(", ")}, status, role)
SELECT ${copyCols.join(", ")},
       CASE WHEN status IN (${sqlList(USER_STATUS_VALUES)}) THEN status ELSE 'active' END,
       CASE WHEN role IN (${sqlList(USER_ROLE_VALUES)}) THEN role ELSE 'user' END
FROM users;
DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_norm
  ON users(phone_norm) WHERE phone_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
`);

      // 2. Teams can be deactivated instead of deleted.
      const teamCols = (
        db.prepare(`PRAGMA table_info(teams)`).all() as { name: string }[]
      ).map((c) => c.name);
      if (!teamCols.includes("is_active")) {
        db.exec(`ALTER TABLE teams ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
      }

      db.exec(`
-- 3. SMS one-time codes for sign-in / sign-up ('login') and binding a phone to
--    an existing password account ('bind'). Only HMACs of codes are stored.
CREATE TABLE IF NOT EXISTS auth_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'bind')),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  consumed_at TEXT,
  voided_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_otps_phone ON auth_otps(phone_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_otps_user ON auth_otps(user_id, created_at);

-- 4. Short-lived proof that a phone was just verified, used to finish sign-up.
CREATE TABLE IF NOT EXISTS signup_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  phone_norm TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_tickets_expires ON signup_tickets(expires_at);

-- 5. Time-limited re-registration hold after account deletion. Stores only a
--    keyed HMAC of the phone and is purged once release_at passes.
CREATE TABLE IF NOT EXISTS phone_holds (
  phone_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  release_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 6. The census: one permanent team vote per account.
CREATE TABLE IF NOT EXISTS fan_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  city TEXT,
  cast_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  voided_at TEXT,
  void_reason TEXT,
  voided_by_user_id INTEGER REFERENCES users(id),
  CHECK (
    (status = 'active' AND voided_at IS NULL AND void_reason IS NULL)
    OR (status = 'void' AND voided_at IS NOT NULL AND length(trim(void_reason)) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS idx_fan_votes_team ON fan_votes(status, team_id);
CREATE INDEX IF NOT EXISTS idx_fan_votes_city ON fan_votes(status, city, team_id);
CREATE INDEX IF NOT EXISTS idx_fan_votes_cast ON fan_votes(cast_at);

CREATE TRIGGER IF NOT EXISTS fan_votes_insert_guard
BEFORE INSERT ON fan_votes
BEGIN
  SELECT RAISE(ABORT, 'VOTE_NOT_ACTIVE') WHERE NEW.status != 'active';
  SELECT RAISE(ABORT, 'VOTE_USER_NOT_ELIGIBLE')
  WHERE NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = NEW.user_id AND phone_verified_at IS NOT NULL AND deleted_at IS NULL
  );
  SELECT RAISE(ABORT, 'VOTE_TEAM_INACTIVE')
  WHERE NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND is_active = 1);
END;

CREATE TRIGGER IF NOT EXISTS fan_votes_immutable
BEFORE UPDATE OF user_id, team_id, city, cast_at ON fan_votes
BEGIN
  SELECT RAISE(ABORT, 'VOTE_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS fan_votes_void_once
BEFORE UPDATE ON fan_votes
WHEN OLD.status = 'void'
BEGIN
  SELECT RAISE(ABORT, 'VOTE_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS fan_votes_no_delete
BEFORE DELETE ON fan_votes
BEGIN
  SELECT RAISE(ABORT, 'VOTE_IMMUTABLE');
END;

-- users.team_id mirrors the vote once one exists and cannot drift from it.
CREATE TRIGGER IF NOT EXISTS users_team_locked
BEFORE UPDATE OF team_id ON users
WHEN EXISTS (SELECT 1 FROM fan_votes WHERE user_id = OLD.id)
  AND NEW.team_id IS NOT (SELECT team_id FROM fan_votes WHERE user_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'TEAM_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS teams_keep_history
BEFORE DELETE ON teams
WHEN EXISTS (SELECT 1 FROM fan_votes WHERE team_id = OLD.id)
  OR EXISTS (SELECT 1 FROM forum_topics WHERE team_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'TEAM_HAS_HISTORY');
END;

-- 7. Append-only audit trail for privileged actions. No OTPs, passwords or
--    phone numbers are ever written here.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  reason TEXT,
  meta TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);

CREATE TRIGGER IF NOT EXISTS audit_log_append_only_u
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;
CREATE TRIGGER IF NOT EXISTS audit_log_append_only_d
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY');
END;
`);
    },
  },
  {
    id: "002_team_catalog_leagues_seasons",
    up(db) {
      // Teams become editable from the admin panel. Catalog defaults from
      // teams.ts only fill rows an admin has never touched.
      const cols = new Set(
        (db.prepare(`PRAGMA table_info(teams)`).all() as { name: string }[]).map((c) => c.name),
      );
      for (const [name, type] of [
        ["city", "TEXT"],
        ["color_primary", "TEXT"],
        ["color_secondary", "TEXT"],
        ["admin_edited_at", "TEXT"],
      ] as const) {
        if (!cols.has(name)) db.exec(`ALTER TABLE teams ADD COLUMN ${name} ${type}`);
      }
      db.exec(`
CREATE TABLE IF NOT EXISTS leagues (
  id TEXT PRIMARY KEY CHECK (id IN (${sqlList([...LEAGUE_ORDER])})),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL,
  CHECK (ends_on > starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_current ON seasons(is_current) WHERE is_current = 1;

-- Which league each team played in during a season. Written when a season
-- is opened, so later league moves never rewrite history.
CREATE TABLE IF NOT EXISTS team_seasons (
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  league_id TEXT NOT NULL REFERENCES leagues(id),
  PRIMARY KEY (season_id, team_id)
);
`);
      const now = new Date().toISOString();
      const insert = db.prepare(
        `INSERT OR IGNORE INTO leagues (id, name, sort_order, updated_at) VALUES (?, ?, ?, ?)`,
      );
      LEAGUE_ORDER.forEach((id, i) => insert.run(id, LEAGUE_LABEL[id], i, now));
    },
  },
];

export function appliedMigrationIds(db: Database.Database) {
  db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);`);
  return new Set(
    (db.prepare(`SELECT id FROM schema_migrations`).all() as { id: string }[]).map(
      (r) => r.id,
    ),
  );
}

export function runMigrations(db: Database.Database, list = MIGRATIONS) {
  const done = appliedMigrationIds(db);
  const ran: string[] = [];
  for (const migration of list) {
    if (done.has(migration.id)) continue;
    const apply = db.transaction(() => {
      migration.up(db);
      if (migration.rebuildsTables) {
        const broken = db.prepare(`PRAGMA foreign_key_check(users)`).all();
        if (broken.length) throw new Error(`MIGRATION_FK_BROKEN:${migration.id}`);
      }
      db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)`).run(
        migration.id,
        new Date().toISOString(),
      );
    });
    if (migration.rebuildsTables) {
      const fkWasOn = Boolean(db.pragma("foreign_keys", { simple: true }));
      db.pragma("foreign_keys = OFF");
      try {
        apply();
      } finally {
        if (fkWasOn) db.pragma("foreign_keys = ON");
      }
    } else {
      apply();
    }
    ran.push(migration.id);
  }
  return ran;
}
