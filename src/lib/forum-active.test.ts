import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { PINNED_STARTER_TOPICS } from "./forum-category";
import { seedPinnedStarterTopics } from "./forum-seed";
import { getMonthlyForumLeader } from "./forum-leaders";
import {
  FORUM_ACTIVE_TEAM_IDS,
  TEAM_IDS,
  TEAMS,
  getTeam,
  isForumActiveTeam,
} from "./teams";

const PREVIOUS_FORUM_20 = [
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "istanbul-basaksehir",
  "goztepe",
  "samsunspor",
  "caykur-rizespor",
  "konyaspor",
  "alanyaspor",
  "kasimpasa",
  "gaziantep-fk",
  "genclerbirligi",
  "kayserispor",
  "kocaelispor",
  "antalyaspor",
  "eyupspor",
  "fatih-karagumruk",
  "adana-demirspor",
  "amed-sfk",
] as const;

const EXPECTED_FORUM_25 = [
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
  "bursaspor",
  "goztepe",
  "mke-ankaragucu",
  "eskisehirspor",
  "adana-demirspor",
  "kocaelispor",
  "sakaryaspor",
  "samsunspor",
  "karsiyaka",
  "antalyaspor",
  "konyaspor",
  "amed-sfk",
  "altay",
  "sivasspor",
  "kayserispor",
  "denizli-idman-yurdu",
  "erzurumspor-fk",
  "giresunspor",
  "52-orduspor",
  "yeni-malatyaspor",
  "zonguldakspor",
] as const;

const ADDED_FROM_NTA = FORUM_ACTIVE_TEAM_IDS.filter(
  (id) => !PREVIOUS_FORUM_20.includes(id as (typeof PREVIOUS_FORUM_20)[number]),
);

test("aktif forum takımı sayısı 25", () => {
  assert.equal(FORUM_ACTIVE_TEAM_IDS.length, 25);
  assert.equal(new Set(FORUM_ACTIVE_TEAM_IDS).size, 25);
  assert.deepEqual([...FORUM_ACTIVE_TEAM_IDS], [...EXPECTED_FORUM_25]);
  assert.notEqual(
    FORUM_ACTIVE_TEAM_IDS.join(","),
    TEAMS.slice(0, 25)
      .map((t) => t.id)
      .join(","),
  );
});

test("listedeki 25 takımın tamamında forum açılabiliyor", () => {
  for (const id of FORUM_ACTIVE_TEAM_IDS) {
    assert.equal(TEAM_IDS.includes(id), true, id);
    assert.ok(getTeam(id), id);
    assert.equal(isForumActiveTeam(id), true, id);
  }
});

test("26. takım aktif değil", () => {
  const extra = TEAM_IDS.find((id) => !FORUM_ACTIVE_TEAM_IDS.includes(id));
  assert.ok(extra);
  assert.equal(isForumActiveTeam(extra), false);
  assert.equal(isForumActiveTeam("istanbul-basaksehir"), false);
});

test("üyelikte 139 takım hala seçilebilir", () => {
  assert.equal(TEAMS.length, 139);
  assert.equal(TEAM_IDS.length, 139);
  assert.equal(new Set(TEAM_IDS).size, 139);
});

test("Tribün Lideri yeni aktif takımlarda çalışıyor", () => {
  assert.ok(ADDED_FROM_NTA.length > 0);
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, league TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT NOT NULL DEFAULT 'hash',
      email_norm TEXT,
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
  `);
  const now = "2026-09-03T12:00:00.000Z";
  db.prepare(`INSERT INTO users (username, status, password_hash) VALUES ('ali', 'active', 'hash')`).run();
  const userId = 1;
  const insertTeam = db.prepare(`INSERT INTO teams (id, name, league) VALUES (?, ?, 'super')`);
  const insertTopic = db.prepare(
    `INSERT INTO forum_topics (team_id, user_id, title, content, created_at, updated_at)
     VALUES (?, ?, 'konu', 'x', ?, ?)`,
  );
  const insertPost = db.prepare(
    `INSERT INTO forum_posts (topic_id, user_id, content, created_at, updated_at)
     VALUES (?, ?, 'yazi', ?, ?)`,
  );
  const sample = ADDED_FROM_NTA.slice(0, 5);
  for (const teamId of sample) {
    insertTeam.run(teamId, teamId);
    const topicId = Number(insertTopic.run(teamId, userId, now, now).lastInsertRowid);
    insertPost.run(topicId, userId, now, now);
    const leader = getMonthlyForumLeader(teamId, 2026, 9, db, now);
    assert.equal(leader?.userId, userId, teamId);
    assert.equal(leader?.postCount, 1, teamId);
  }
  db.close();
});

test("Anılar seed duplicate oluşturmuyor", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, league TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      username_norm TEXT UNIQUE,
      display_name TEXT,
      email TEXT,
      email_norm TEXT UNIQUE,
      password_hash TEXT,
      team_id TEXT,
      status TEXT,
      role TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL REFERENCES teams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      category TEXT,
      is_pinned INTEGER,
      deleted_at TEXT
    );
  `);
  const insertTeam = db.prepare(`INSERT INTO teams (id, name, league) VALUES (?, ?, 'super')`);
  for (const id of FORUM_ACTIVE_TEAM_IDS) insertTeam.run(id, id);
  seedPinnedStarterTopics(db);
  seedPinnedStarterTopics(db);
  const count = (
    db.prepare(`SELECT COUNT(*) as c FROM forum_topics WHERE is_pinned = 1`).get() as {
      c: number;
    }
  ).c;
  assert.equal(count, FORUM_ACTIVE_TEAM_IDS.length * PINNED_STARTER_TOPICS.length);
  db.close();
});
