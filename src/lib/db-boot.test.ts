import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { applyDatabaseBoot } from "./db";
import { MIGRATIONS } from "./migrations";
import { SEED_DOMAIN } from "./seed-votes";

test("boot + migrations are idempotent and recorded once", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applyDatabaseBoot(db);
  applyDatabaseBoot(db);
  const teams = (
    db.prepare(`SELECT COUNT(*) as c FROM teams WHERE is_forum_active = 1`).get() as {
      c: number;
    }
  ).c;
  assert.equal(teams, 25);
  const applied = db.prepare(`SELECT id FROM schema_migrations ORDER BY id`).all() as {
    id: string;
  }[];
  assert.deepEqual(
    applied.map((r) => r.id),
    MIGRATIONS.map((m) => m.id),
  );
  assert.equal(Boolean(db.pragma("foreign_keys", { simple: true })), true);
  db.close();
});

test("migration keeps existing users and their data", () => {
  const db = new Database(":memory:");
  // Simulate a database from before the migration: baseline only.
  db.exec(`CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  for (const m of MIGRATIONS) {
    db.prepare(`INSERT INTO schema_migrations VALUES (?, 'x')`).run(m.id);
  }
  applyDatabaseBoot(db);
  db.exec(`DELETE FROM schema_migrations`);
  // Recreate the old users shape the way older builds did.
  db.pragma("foreign_keys = OFF");
  db.exec(`DROP TABLE users`);
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL, username_norm TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      email TEXT NOT NULL, email_norm TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active', role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT,
      banned_at TEXT, ban_reason TEXT, ban_expires_at TEXT,
      participant_id INTEGER UNIQUE REFERENCES participants(id) ON DELETE SET NULL,
      first_name TEXT, last_name TEXT, birth_date TEXT, phone TEXT, phone_norm TEXT, city TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0, totp_secret_enc TEXT, email_verified_at TEXT
    )`);
  db.prepare(
    `INSERT INTO users (username, username_norm, display_name, email, email_norm, password_hash,
       team_id, status, role, created_at, updated_at, phone_norm)
     VALUES ('eski', 'eski', 'Eski Üye', 'e@x.com', 'e@x.com', 'scrypt$aa$bb', 'galatasaray',
       'active', 'admin', '2026-01-01', '2026-01-01', '5321112233')`,
  ).run();
  db.pragma("foreign_keys = ON");

  applyDatabaseBoot(db);
  const u = db.prepare(`SELECT * FROM users WHERE username_norm = 'eski'`).get() as Record<
    string,
    unknown
  >;
  assert.equal(u.email, "e@x.com");
  assert.equal(u.role, "admin");
  assert.equal(u.team_id, "galatasaray");
  assert.equal(u.phone_norm, "5321112233");
  assert.equal(u.phone_verified_at, null);
  // New columns exist and email is now optional.
  db.prepare(
    `INSERT INTO users (username, username_norm, display_name, created_at, updated_at)
     VALUES ('yeni', 'yeni', 'yeni', 'x', 'x')`,
  ).run();
  assert.throws(() =>
    db
      .prepare(`UPDATE users SET role = 'root' WHERE username_norm = 'yeni'`)
      .run(),
  );
  db.close();
});

test("boot strips leftover demo ballots", () => {
  const db = new Database(":memory:");
  applyDatabaseBoot(db);
  db.prepare(
    `INSERT INTO participants (email, email_norm, team_id, city, ip_hash, fingerprint_hash,
       consent_version, consent_at, created_at, verified_at)
     VALUES (?, ?, 'galatasaray', 'İstanbul', 'i', 'f', 'v', 'x', 'x', 'x')`,
  ).run(`seed.v4.001@${SEED_DOMAIN}`, `seed.v4.001@${SEED_DOMAIN}`);
  applyDatabaseBoot(db);
  const left = (
    db
      .prepare(`SELECT COUNT(*) as c FROM participants WHERE email_norm LIKE ?`)
      .get(`%@${SEED_DOMAIN}`) as { c: number }
  ).c;
  assert.equal(left, 0);
  db.close();
});
