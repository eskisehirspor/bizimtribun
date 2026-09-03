import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  FORUM_SYSTEM_EMAIL,
  FORUM_SYSTEM_PASSWORD_HASH,
  isForumSystemAccount,
} from "./forum-system";
import {
  getCurrentForumLeaderUserId,
  getForumLeaderHistory,
  getMonthlyForumLeader,
  saveForumLeader,
} from "./forum-leaders";

const NOW = new Date("2026-09-03T12:00:00+03:00");
const NOW_ISO = NOW.toISOString();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function at(year: number, month: number, day: number, hour = 12) {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:00:00+03:00`,
  ).toISOString();
}

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      league TEXT NOT NULL
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_norm TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email TEXT NOT NULL,
      email_norm TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      banned_at TEXT,
      ban_expires_at TEXT
    );
    CREATE TABLE forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL REFERENCES teams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      held_at TEXT
    );
    CREATE TABLE forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES forum_topics(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      held_at TEXT
    );
    CREATE TABLE forum_leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL REFERENCES teams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      post_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (team_id, year, month)
    );
  `);
  db.prepare(`INSERT INTO teams (id, name, league) VALUES (?, ?, ?)`).run(
    "fenerbahce",
    "Fenerbahçe",
    "super",
  );
  db.prepare(`INSERT INTO teams (id, name, league) VALUES (?, ?, ?)`).run(
    "galatasaray",
    "Galatasaray",
    "super",
  );
  return db;
}

function addUser(
  db: Database.Database,
  username: string,
  extra?: { password?: string; email?: string; status?: string; bannedAt?: string | null; role?: string },
) {
  const now = NOW_ISO;
  const email = extra?.email ?? `${username}@example.com`;
  const info = db
    .prepare(
      `INSERT INTO users
       (username, username_norm, display_name, email, email_norm, password_hash,
        status, role, created_at, updated_at, banned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      username,
      username,
      username,
      email,
      email,
      extra?.password ?? "hash",
      extra?.status ?? "active",
      extra?.role ?? "user",
      now,
      now,
      extra?.bannedAt ?? null,
    );
  return Number(info.lastInsertRowid);
}

function addTopic(
  db: Database.Database,
  teamId: string,
  userId: number,
  title: string,
) {
  const now = NOW_ISO;
  const info = db
    .prepare(
      `INSERT INTO forum_topics
       (team_id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, 'x', ?, ?)`,
    )
    .run(teamId, userId, title, now, now);
  return Number(info.lastInsertRowid);
}

function addPost(
  db: Database.Database,
  topicId: number,
  userId: number,
  createdAt: string,
  extra?: { deletedAt?: string | null; heldAt?: string | null },
) {
  db.prepare(
    `INSERT INTO forum_posts
     (topic_id, user_id, content, created_at, updated_at, deleted_at, held_at)
     VALUES (?, ?, 'yazi', ?, ?, ?, ?)`,
  ).run(
    topicId,
    userId,
    createdAt,
    createdAt,
    extra?.deletedAt ?? null,
    extra?.heldAt ?? null,
  );
}

function sepLeader(db: Database.Database, teamId: string) {
  return getMonthlyForumLeader(teamId, 2026, 9, db, NOW_ISO);
}

test("en çok geçerli post sahibi lider", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1));
  addPost(db, topic, a, at(2026, 9, 2));
  addPost(db, topic, a, at(2026, 9, 3));
  addPost(db, topic, b, at(2026, 9, 2));
  addPost(db, topic, b, at(2026, 9, 3));
  const leader = sepLeader(db, "fenerbahce");
  assert.equal(leader?.userId, a);
  assert.equal(leader?.postCount, 3);
  db.close();
});

test("deleted post sayılmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1), { deletedAt: NOW_ISO });
  addPost(db, topic, a, at(2026, 9, 2), { deletedAt: NOW_ISO });
  addPost(db, topic, a, at(2026, 9, 3));
  addPost(db, topic, b, at(2026, 9, 1));
  addPost(db, topic, b, at(2026, 9, 2));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, b);
  db.close();
});

test("held post sayılmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1), { heldAt: NOW_ISO });
  addPost(db, topic, a, at(2026, 9, 2), { heldAt: NOW_ISO });
  addPost(db, topic, a, at(2026, 9, 3));
  addPost(db, topic, b, at(2026, 9, 1));
  addPost(db, topic, b, at(2026, 9, 2));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, b);
  db.close();
});

test("moderation block sayılmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, b, at(2026, 9, 1));
  const leader = sepLeader(db, "fenerbahce");
  assert.equal(leader?.userId, b);
  assert.equal(leader?.postCount, 1);
  db.close();
});

test("system user sayılmaz", () => {
  const db = openDb();
  const sys = addUser(db, "tribun", {
    password: FORUM_SYSTEM_PASSWORD_HASH,
    email: FORUM_SYSTEM_EMAIL,
  });
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", sys, "anil");
  addPost(db, topic, sys, at(2026, 9, 1));
  addPost(db, topic, sys, at(2026, 9, 2));
  addPost(db, topic, sys, at(2026, 9, 3));
  addPost(db, topic, a, at(2026, 9, 4));
  assert.equal(isForumSystemAccount({ password_hash: FORUM_SYSTEM_PASSWORD_HASH, email_norm: FORUM_SYSTEM_EMAIL }), true);
  assert.equal(sepLeader(db, "fenerbahce")?.userId, a);
  db.close();
});

test("admin/system içerikleri sayılmaz", () => {
  const db = openDb();
  const sysAdmin = addUser(db, "seedbot", {
    password: FORUM_SYSTEM_PASSWORD_HASH,
    email: "seed@bizimtribun.internal",
    role: "admin",
  });
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", sysAdmin, "sistem");
  addPost(db, topic, sysAdmin, at(2026, 9, 1));
  addPost(db, topic, sysAdmin, at(2026, 9, 2));
  addPost(db, topic, a, at(2026, 9, 3));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, a);
  db.close();
});

test("başka takım forumundaki post sayılmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const fb = addTopic(db, "fenerbahce", b, "fb");
  const gs = addTopic(db, "galatasaray", a, "gs");
  addPost(db, gs, a, at(2026, 9, 1));
  addPost(db, gs, a, at(2026, 9, 2));
  addPost(db, gs, a, at(2026, 9, 3));
  addPost(db, fb, b, at(2026, 9, 1));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, b);
  assert.equal(sepLeader(db, "fenerbahce")?.postCount, 1);
  db.close();
});

test("farklı takımlarda aynı kullanıcı lider olabilir", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const fb = addTopic(db, "fenerbahce", a, "fb");
  const gs = addTopic(db, "galatasaray", a, "gs");
  addPost(db, fb, a, at(2026, 9, 1));
  addPost(db, gs, a, at(2026, 9, 2));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, a);
  assert.equal(sepLeader(db, "galatasaray")?.userId, a);
  db.close();
});

test("eşitlik deterministic", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, b, at(2026, 9, 2, 14));
  addPost(db, topic, b, at(2026, 9, 3));
  addPost(db, topic, a, at(2026, 9, 2, 10));
  addPost(db, topic, a, at(2026, 9, 4));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, a);

  const db2 = openDb();
  const x = addUser(db2, "can");
  const y = addUser(db2, "deniz");
  const t2 = addTopic(db2, "fenerbahce", x, "mac");
  const same = at(2026, 9, 1, 12);
  addPost(db2, t2, y, same);
  addPost(db2, t2, y, at(2026, 9, 2));
  addPost(db2, t2, x, same);
  addPost(db2, t2, x, at(2026, 9, 3));
  assert.equal(sepLeader(db2, "fenerbahce")?.userId, x);
  db.close();
  db2.close();
});

test("aynı ay ikinci leader kaydı oluşmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 8, 10));
  const first = saveForumLeader("fenerbahce", 2026, 8, db, NOW_ISO);
  const second = saveForumLeader("fenerbahce", 2026, 8, db, NOW_ISO);
  assert.equal(first.saved, true);
  assert.equal(second.saved, false);
  const n = (
    db.prepare(`SELECT COUNT(*) as c FROM forum_leaders`).get() as { c: number }
  ).c;
  assert.equal(n, 1);
  db.close();
});

test("banned kullanıcı lider olamaz", () => {
  const db = openDb();
  const a = addUser(db, "ali", { status: "banned", bannedAt: NOW_ISO });
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1));
  addPost(db, topic, a, at(2026, 9, 2));
  addPost(db, topic, a, at(2026, 9, 3));
  addPost(db, topic, b, at(2026, 9, 4));
  assert.equal(sepLeader(db, "fenerbahce")?.userId, b);
  db.close();
});

test("geçmiş liderler korunur", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 8, 5));
  saveForumLeader("fenerbahce", 2026, 8, db, NOW_ISO);
  db.prepare(
    `UPDATE users SET status = 'banned', banned_at = ? WHERE id = ?`,
  ).run(NOW_ISO, a);
  const history = getForumLeaderHistory("fenerbahce", db, 12, NOW);
  assert.equal(history.length, 1);
  assert.equal(history[0].username, "ali");
  assert.equal(history[0].year, 2026);
  assert.equal(history[0].month, 8);
  assert.equal(history[0].postCount, 1);
  assert.equal(history[0].teamId, "fenerbahce");
  db.close();
});

test("mevcut ay badge doğru kullanıcıda görünür", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1));
  addPost(db, topic, a, at(2026, 9, 2));
  addPost(db, topic, b, at(2026, 9, 3));
  const leaderId = getCurrentForumLeaderUserId("fenerbahce", db, NOW);
  assert.equal(leaderId, a);
  assert.notEqual(leaderId, b);
  db.close();
});
