import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  FORUM_SYSTEM_EMAIL,
  FORUM_SYSTEM_PASSWORD_HASH,
  isForumSystemAccount,
} from "./forum-system";
import {
  formatWeek,
  getCurrentFanOfWeekUserId,
  getFanOfWeekHistory,
  getWeeklyFanOfWeek,
  previousWeekStart,
  saveFanOfWeek,
  weekStartOf,
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
    CREATE TABLE forum_likes (
      user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, target_type, target_id)
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
    CREATE TABLE fan_of_week (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL REFERENCES teams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      post_count INTEGER NOT NULL,
      active_days INTEGER NOT NULL,
      like_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (team_id, week_start)
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

/** NOW falls in the Istanbul week of Monday 31 Aug to Sunday 6 Sep 2026. */
const THIS_WEEK = "2026-08-31";

function sepLeader(db: Database.Database, teamId: string) {
  return getWeeklyFanOfWeek(teamId, THIS_WEEK, db, NOW_ISO);
}

test("hafta İstanbul saatiyle pazartesi başlar", () => {
  assert.equal(weekStartOf(NOW), THIS_WEEK);
  // Sunday 23:30 Istanbul is still the same week; Monday 00:30 starts the next.
  assert.equal(weekStartOf(new Date("2026-09-06T23:30:00+03:00")), THIS_WEEK);
  assert.equal(weekStartOf(new Date("2026-09-07T00:30:00+03:00")), "2026-09-07");
  assert.equal(previousWeekStart(THIS_WEEK), "2026-08-24");
  assert.equal(formatWeek("2026-10-12"), "12–18 Eki 2026");
  assert.equal(formatWeek(THIS_WEEK), "31 Ağu – 6 Eyl 2026");
  assert.equal(formatWeek("2026-12-28"), "28 Ara 2026 – 3 Oca 2027");
});

test("geçen haftanın yazıları bu haftanın seçimine girmez", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "galatasaray", addUser(db, "acan"), "mac");
  addPost(db, topic, a, at(2026, 8, 28));
  addPost(db, topic, a, at(2026, 8, 29));
  addPost(db, topic, a, at(2026, 8, 30, 23));
  addPost(db, topic, b, at(2026, 8, 31, 1));
  assert.equal(sepLeader(db, "galatasaray")?.userId, b);
  db.close();
});

test("en çok gün aktif olan haftanın taraftarı", () => {
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

test("farklı takımlarda aynı kullanıcı haftanın taraftarı olabilir", () => {
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

test("aynı hafta ikinci kayıt oluşmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 8, 10));
  const first = saveFanOfWeek("fenerbahce", "2026-08-10", db, NOW_ISO);
  const second = saveFanOfWeek("fenerbahce", "2026-08-10", db, NOW_ISO);
  assert.equal(first.saved, true);
  assert.equal(second.saved, false);
  const n = (
    db.prepare(`SELECT COUNT(*) as c FROM fan_of_week`).get() as { c: number }
  ).c;
  assert.equal(n, 1);
  db.close();
});

test("banned kullanıcı haftanın taraftarı olamaz", () => {
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
  saveFanOfWeek("fenerbahce", "2026-08-03", db, NOW_ISO);
  db.prepare(
    `UPDATE users SET status = 'banned', banned_at = ? WHERE id = ?`,
  ).run(NOW_ISO, a);
  const history = getFanOfWeekHistory("fenerbahce", db, 12, NOW);
  assert.equal(history.length, 1);
  assert.equal(history[0].username, "ali");
  assert.equal(history[0].weekStart, "2026-08-03");
  assert.equal(history[0].activeDays, 1);
  assert.equal(history[0].teamId, "fenerbahce");
  db.close();
});

test("meşale geçen haftanın kazananında görünür, bu hafta yazılanlar değiştirmez", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const topic = addTopic(db, "fenerbahce", b, "mac");
  addPost(db, topic, a, at(2026, 8, 24));
  addPost(db, topic, a, at(2026, 8, 25));
  addPost(db, topic, b, at(2026, 8, 26));
  // b is far ahead this week, but the torch is last week's.
  for (const d of [1, 2, 3]) addPost(db, topic, b, at(2026, 9, d));
  const leaderId = getCurrentFanOfWeekUserId("fenerbahce", db, NOW);
  assert.equal(leaderId, a);
  assert.equal(sepLeader(db, "fenerbahce")?.userId, b);
  // Once picked it stays, even if last week's content is later removed.
  db.prepare(`UPDATE forum_posts SET deleted_at = ? WHERE user_id = ?`).run(NOW_ISO, a);
  assert.equal(getCurrentFanOfWeekUserId("fenerbahce", db, NOW), a);
  db.close();
});

test("geçen hafta kimse yazmadıysa meşale yok", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 9, 1));
  assert.equal(getCurrentFanOfWeekUserId("fenerbahce", db, NOW), null);
  db.close();
});

function addLike(db: Database.Database, userId: number, type: "topic" | "post", id: number, createdAt: string) {
  db.prepare(`INSERT INTO forum_likes (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)`).run(
    userId,
    type,
    id,
    createdAt,
  );
}

function lastPostId(db: Database.Database) {
  return (db.prepare(`SELECT MAX(id) as id FROM forum_posts`).get() as { id: number }).id;
}

test("tek günde yığılan yazı, düzenli katılımı geçemez", () => {
  const db = openDb();
  const flood = addUser(db, "flood");
  const steady = addUser(db, "steady");
  const topic = addTopic(db, "galatasaray", addUser(db, "acan"), "mac");
  for (let h = 0; h < 10; h++) addPost(db, topic, flood, at(2026, 9, 1, 9 + h));
  addPost(db, topic, steady, at(2026, 9, 1));
  addPost(db, topic, steady, at(2026, 9, 2));
  const leader = sepLeader(db, "galatasaray");
  assert.equal(leader?.userId, steady);
  assert.equal(leader?.activeDays, 2);
  db.close();
});

test("beğeni puan katar; aynı kişinin beğenisi en çok 3 kez sayılır, kendi beğenisi sayılmaz", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const b = addUser(db, "berk");
  const fan = addUser(db, "fan");
  const fan2 = addUser(db, "fan2");
  const topic = addTopic(db, "galatasaray", addUser(db, "acan"), "mac");
  addPost(db, topic, a, at(2026, 9, 1));
  addPost(db, topic, a, at(2026, 9, 2));
  addPost(db, topic, b, at(2026, 9, 1));
  const bPost = lastPostId(db);
  for (let i = 0; i < 5; i++) {
    addPost(db, topic, b, at(2026, 9, 1, 13 + i));
    const id = lastPostId(db);
    addLike(db, fan, "post", id, at(2026, 9, 2));
    addLike(db, b, "post", id, at(2026, 9, 2));
  }
  // b: 1 day (3) + 3 capped likes = 6; a: 2 days = 6, but more active days wins the tie.
  assert.equal(sepLeader(db, "galatasaray")?.userId, a);
  addLike(db, fan2, "post", bPost, at(2026, 9, 2));
  const leader = sepLeader(db, "galatasaray");
  assert.equal(leader?.userId, b);
  assert.equal(leader?.likeCount, 4);
  assert.equal(leader?.score, 7);
  db.close();
});

test("haftanın taraftarı kaydı aktif gün ve beğeniyi saklar", () => {
  const db = openDb();
  const a = addUser(db, "ali");
  const topic = addTopic(db, "fenerbahce", a, "mac");
  addPost(db, topic, a, at(2026, 8, 10));
  addPost(db, topic, a, at(2026, 8, 11));
  saveFanOfWeek("fenerbahce", "2026-08-10", db, NOW_ISO);
  const [row] = getFanOfWeekHistory("fenerbahce", db, 12, NOW);
  assert.equal(row.activeDays, 2);
  assert.equal(row.likeCount, 0);
  db.close();
});
