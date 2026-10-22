import assert from "node:assert/strict";
import { test } from "node:test";
import { scratchDb } from "../db-test";
import type { Db } from "../db";
import { getWeeklyFanOfWeek } from "../forum-leaders";
import {
  approveHeldContent,
  banHeldAuthor,
  countHeldItems,
  heldModerationAdminGate,
  isPublicForumSqlRow,
  listHeldItems,
  loadHeldTarget,
  parseHeldId,
  parseHeldKind,
  rejectHeldContent,
} from "./held";

const NOW = "2026-09-03T12:00:00.000Z";

async function openDb() {
  const db = await scratchDb();
  await db.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      banned_at TEXT,
      ban_reason TEXT,
      ban_expires_at TEXT,
      email_norm TEXT,
      password_hash TEXT NOT NULL DEFAULT 'hash',
      notify_replies INTEGER NOT NULL DEFAULT 1,
      notify_mentions INTEGER NOT NULL DEFAULT 1,
      notify_likes INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board TEXT NOT NULL DEFAULT 'team',
      city TEXT,
      team_id TEXT,
      user_id INTEGER NOT NULL,
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
      topic_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      held_at TEXT
    );
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      actor_user_id INTEGER,
      topic_id INTEGER,
      post_id INTEGER,
      body TEXT NOT NULL,
      dedupe_key TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, dedupe_key)
    );
    CREATE TABLE user_blocks (
      blocker_user_id INTEGER NOT NULL,
      blocked_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE moderation_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moderator_user_id INTEGER NOT NULL,
      target_user_id INTEGER,
      target_topic_id INTEGER,
      target_post_id INTEGER,
      action TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.prepare(`INSERT INTO teams (id, name) VALUES (?, ?)`).run(
        "fenerbahce",
        "Fenerbahçe",
      );
  return db;
}

async function addUser(
  db: Db,
  username: string,
  role = "user",
) {
  const info = await db
      .prepare(
        `INSERT INTO users (username, role, status, created_at, updated_at, email_norm, password_hash)
       VALUES (?, ?, 'active', ?, ?, ?, 'hash')`,
      )
      .run(username, role, NOW, NOW, `${username}@example.com`);
  return Number(info.lastInsertRowid);
}

async function addTopic(
  db: Db,
  userId: number,
  extra?: { heldAt?: string | null; deletedAt?: string | null; title?: string },
) {
  const info = await db
      .prepare(
        `INSERT INTO forum_topics
       (team_id, user_id, title, content, created_at, updated_at, held_at, deleted_at)
       VALUES ('fenerbahce', ?, ?, 'konu govde', ?, ?, ?, ?)`,
      )
      .run(
        userId,
        extra?.title ?? "Derbi",
        NOW,
        NOW,
        extra?.heldAt ?? null,
        extra?.deletedAt ?? null,
      );
  return Number(info.lastInsertRowid);
}

async function addPost(
  db: Db,
  topicId: number,
  userId: number,
  extra?: { heldAt?: string | null; deletedAt?: string | null; createdAt?: string },
) {
  const created = extra?.createdAt ?? NOW;
  const info = await db
      .prepare(
        `INSERT INTO forum_posts
       (topic_id, user_id, content, created_at, updated_at, held_at, deleted_at)
       VALUES (?, ?, 'yorum', ?, ?, ?, ?)`,
      )
      .run(
        topicId,
        userId,
        created,
        created,
        extra?.heldAt ?? null,
        extra?.deletedAt ?? null,
      );
  return Number(info.lastInsertRowid);
}

async function addAutoReview(
  db: Db,
  userId: number,
  topicId: number | null,
  postId: number | null,
  reason: string,
) {
  await db.prepare(
        `INSERT INTO moderation_actions
     (moderator_user_id, target_user_id, target_topic_id, target_post_id, action, reason, created_at)
     VALUES (?, ?, ?, ?, 'auto_review', ?, ?)`,
      ).run(userId, userId, topicId, postId, reason, NOW);
}

async function publicTopicCount(db: Db) {
  return (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM forum_topics
         WHERE deleted_at IS NULL AND held_at IS NULL`,
            )
            .get() as { c: number }
  ).c;
}

async function publicPostCount(db: Db, topicId: number) {
  return (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM forum_posts
         WHERE topic_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
            )
            .get(topicId) as { c: number }
  ).c;
}

async function lastPublicActivity(db: Db, topicId: number) {
  return (
    await db
            .prepare(
              `SELECT MAX(created_at) as lastAt FROM forum_posts
         WHERE topic_id = ? AND deleted_at IS NULL AND held_at IS NULL`,
            )
            .get(topicId) as { lastAt: string | null }
  ).lastAt;
}

async function audits(db: Db, action: string) {
  return await db
      .prepare(`SELECT * FROM moderation_actions WHERE action = ? ORDER BY id`)
      .all(action) as Array<{
    action: string;
    reason: string | null;
    moderator_user_id: number;
    target_topic_id: number | null;
    target_post_id: number | null;
    target_user_id: number | null;
    created_at: string;
  }>;
}

test("held topic public görünmez", async () => {
  const db = await openDb();
  const u = await addUser(db, "ali");
  const live = await addTopic(db, u);
  const held = await addTopic(db, u, { heldAt: NOW });
  const liveRow = await db
      .prepare(`SELECT deleted_at, held_at FROM forum_topics WHERE id = ?`)
      .get(live) as { deleted_at: string | null; held_at: string | null };
  const heldRow = await db
      .prepare(`SELECT deleted_at, held_at FROM forum_topics WHERE id = ?`)
      .get(held) as { deleted_at: string | null; held_at: string | null };
  assert.equal(isPublicForumSqlRow(liveRow), true);
  assert.equal(isPublicForumSqlRow(heldRow), false);
  assert.equal(await publicTopicCount(db), 1);
});

test("held post public görünmez", async () => {
  const db = await openDb();
  const u = await addUser(db, "ali");
  const topic = await addTopic(db, u);
  await addPost(db, topic, u);
  await addPost(db, topic, u, { heldAt: NOW });
  assert.equal(await publicPostCount(db, topic), 1);
});

test("held içerik yorum sayısına ve son aktiviteye dahil olmaz", async () => {
  const db = await openDb();
  const u = await addUser(db, "ali");
  const topic = await addTopic(db, u);
  await addPost(db, topic, u, { createdAt: "2026-09-01T10:00:00.000Z" });
  await addPost(db, topic, u, {
        heldAt: NOW,
        createdAt: "2026-09-03T18:00:00.000Z",
      });
  assert.equal(await publicPostCount(db, topic), 1);
  assert.equal(await lastPublicActivity(db, topic), "2026-09-01T10:00:00.000Z");
});

test("held içerik Haftanın Taraftarı hesabına dahil olmaz", async () => {
  const db = await openDb();
  const a = await addUser(db, "ali");
  const b = await addUser(db, "berk");
  const topic = await addTopic(db, a);
  await addPost(db, topic, a, { heldAt: NOW, createdAt: "2026-09-01T10:00:00.000Z" });
  await addPost(db, topic, a, { heldAt: NOW, createdAt: "2026-09-02T10:00:00.000Z" });
  await addPost(db, topic, b, { createdAt: "2026-09-01T11:00:00.000Z" });
  const leader = await getWeeklyFanOfWeek("fenerbahce", "2026-08-31", db, NOW);
  assert.equal(leader?.userId, b);
  assert.equal(leader?.postCount, 1);
});

test("admin held listeyi görür, non-admin göremez", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const admin = await addUser(db, "mod", "admin");
  await addTopic(db, author, { heldAt: NOW, title: "Bekleyen konu" });
  await addAutoReview(
        db,
        author,
        1,
        null,
        "auto:review:spam:medium:struct.token-repeat",
      );
  assert.equal(heldModerationAdminGate({ role: "user" }).ok, false);
  assert.equal(heldModerationAdminGate({ role: "user" }).status, 403);
  assert.equal(heldModerationAdminGate(null).status, 401);
  assert.equal(heldModerationAdminGate({ role: "admin" }).ok, true);
  const listed = await listHeldItems(db, 0, 25);
  assert.equal(listed.total, 1);
  assert.equal(await countHeldItems(db), 1);
  assert.equal(listed.items[0]?.title, "Bekleyen konu");
  assert.equal(listed.items[0]?.kind, "topic");
  assert.equal(listed.items[0]?.category, "spam");
  assert.equal(listed.items[0]?.severity, "medium");
  assert.equal(listed.items[0]?.ruleId, "struct.token-repeat");
  assert.equal(listed.items[0]?.username, "ali");
  assert.equal(admin > 0, true);
});

test("approve → held null + public + audit", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  await addAutoReview(db, author, topicId, null, "auto:review:spam:low");
  const first = await approveHeldContent(db, "topic", topicId, mod, null);
  assert.equal(first.ok, true);
  const row = await db
      .prepare(`SELECT held_at, deleted_at FROM forum_topics WHERE id = ?`)
      .get(topicId) as { held_at: string | null; deleted_at: string | null };
  assert.equal(row.held_at, null);
  assert.equal(row.deleted_at, null);
  assert.equal(isPublicForumSqlRow(row), true);
  const rows = await audits(db, "approve_moderation");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.moderator_user_id, mod);
  assert.equal(rows[0]?.target_topic_id, topicId);
  assert.equal(rows[0]?.target_post_id, null);
  assert.ok(rows[0]?.reason?.includes("auto_review:"));
  assert.ok(rows[0]?.created_at);
});

test("reject → deleted + audit + reason zorunlu", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  assert.equal(
    (await rejectHeldContent(db, "topic", topicId, mod, "ab")).ok,
    false,
  );
  const ok = await rejectHeldContent(db, "topic", topicId, mod, "spam kuyruk");
  assert.equal(ok.ok, true);
  const row = await db
      .prepare(`SELECT held_at, deleted_at FROM forum_topics WHERE id = ?`)
      .get(topicId) as { held_at: string | null; deleted_at: string | null };
  assert.ok(row.deleted_at);
  assert.equal(row.held_at, null);
  assert.equal(isPublicForumSqlRow(row), false);
  const rows = await audits(db, "reject_moderation");
  assert.equal(rows.length, 1);
  assert.ok(rows[0]?.reason?.includes("spam kuyruk"));
});

test("aynı içerik iki kez action alamaz", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  assert.equal((await approveHeldContent(db, "topic", topicId, mod, null)).ok, true);
  const second = await approveHeldContent(db, "topic", topicId, mod, null);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.status, 409);
});

test("approve sonrası reject olmaz", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  assert.equal((await approveHeldContent(db, "topic", topicId, mod, null)).ok, true);
  const rejected = await rejectHeldContent(db, "topic", topicId, mod, "geç kaldı");
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.status, 409);
});

test("reject sonrası approve olmaz", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  assert.equal((await rejectHeldContent(db, "topic", topicId, mod, "reddet")).ok, true);
  const approved = await approveHeldContent(db, "topic", topicId, mod, null);
  assert.equal(approved.ok, false);
  if (!approved.ok) assert.equal(approved.status, 409);
});

test("IDOR: yanlis type ve olmayan id", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  await addTopic(db, author);
  const topicId = await addTopic(db, author, { heldAt: NOW });
  const postId = await addPost(db, topicId, author, { heldAt: NOW });
  assert.equal(parseHeldKind("comment"), null);
  assert.equal(parseHeldKind("topic"), "topic");
  assert.equal(parseHeldId("abc"), null);
  const missing = await loadHeldTarget(db, "topic", 99);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);
  const postAsTopic = await loadHeldTarget(db, "post", topicId);
  assert.equal(postAsTopic.ok, false);
  if (!postAsTopic.ok) assert.equal(postAsTopic.status, 404);
  const liveAsHeld = await loadHeldTarget(db, "topic", postId);
  assert.equal(liveAsHeld.ok, false);
  if (!liveAsHeld.ok) assert.equal(liveAsHeld.status, 409);
});

test("ban → mevcut ban sistemi + içerik reddedilir", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author, { heldAt: NOW });
  await db.prepare(`INSERT INTO sessions (user_id, revoked_at) VALUES (?, NULL)`).run(
        author,
      );
  assert.equal((await banHeldAuthor(db, "topic", topicId, mod, "ab")).ok, false);
  const banned = await banHeldAuthor(db, "topic", topicId, mod, "tekrar ihlal");
  assert.equal(banned.ok, true);
  const user = await db
      .prepare(`SELECT status, banned_at, ban_reason FROM users WHERE id = ?`)
      .get(author) as {
    status: string;
    banned_at: string | null;
    ban_reason: string | null;
  };
  assert.equal(user.status, "banned");
  assert.ok(user.banned_at);
  assert.equal(user.ban_reason, "tekrar ihlal");
  const session = await db
      .prepare(`SELECT revoked_at FROM sessions WHERE user_id = ?`)
      .get(author) as { revoked_at: string | null };
  assert.ok(session.revoked_at);
  const topic = await db
      .prepare(`SELECT held_at, deleted_at FROM forum_topics WHERE id = ?`)
      .get(topicId) as { held_at: string | null; deleted_at: string | null };
  assert.ok(topic.deleted_at);
  assert.equal(topic.held_at, null);
  assert.equal(isPublicForumSqlRow(topic), false);
  assert.equal((await audits(db, "ban_user")).length, 1);
  assert.equal((await audits(db, "reject_moderation")).length, 1);
  const adminId = await addUser(db, "yonetici", "admin");
  const adminTopic = await addTopic(db, adminId, { heldAt: NOW });
  const adminBan = await banHeldAuthor(db, "topic", adminTopic, mod, "admin deneme");
  assert.equal(adminBan.ok, false);
});

test("held post approve/reject", async () => {
  const db = await openDb();
  const author = await addUser(db, "ali");
  const mod = await addUser(db, "mod", "admin");
  const topicId = await addTopic(db, author);
  const postId = await addPost(db, topicId, author, { heldAt: NOW });
  assert.equal((await listHeldItems(db, 0, 10)).items[0]?.kind, "post");
  assert.equal((await approveHeldContent(db, "post", postId, mod, "uygun")).ok, true);
  const row = await db
      .prepare(`SELECT held_at, deleted_at FROM forum_posts WHERE id = ?`)
      .get(postId) as { held_at: string | null; deleted_at: string | null };
  assert.equal(row.held_at, null);
  const other = await addPost(db, topicId, author, { heldAt: NOW });
  assert.equal((await rejectHeldContent(db, "post", other, mod, "uygunsuz")).ok, true);
});
