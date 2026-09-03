import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { CITIES } from "./cities";
import { FORUM_ACTIVE_TEAM_IDS, TEAMS } from "./teams";
import {
  SITEMAP_MAX_URLS,
  activeForumSitemapEntries,
  buildPublicSitemap,
  publicTopicSitemapEntries,
  staticSitemapEntries,
} from "./sitemap-policy";

const BASE = "https://bizimtribun.example";

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      league TEXT NOT NULL DEFAULT 'super',
      is_forum_active INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 't',
      content TEXT NOT NULL DEFAULT 'c',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      held_at TEXT
    );
  `);
  return db;
}

function seedCatalog(db: Database.Database) {
  const insert = db.prepare(
    `INSERT INTO teams (id, name, league, is_forum_active) VALUES (?, ?, ?, 0)`,
  );
  for (const team of TEAMS) {
    insert.run(team.id, team.name, team.league);
  }
  const activate = db.prepare(`UPDATE teams SET is_forum_active = 1 WHERE id = ?`);
  for (const id of FORUM_ACTIVE_TEAM_IDS) activate.run(id);
}

function insertTopic(
  db: Database.Database,
  over: {
    teamId: string;
    updatedAt: string;
    deletedAt?: string | null;
    heldAt?: string | null;
  },
) {
  const info = db
    .prepare(
      `INSERT INTO forum_topics
       (team_id, title, content, created_at, updated_at, deleted_at, held_at)
       VALUES (?, 'Konu', 'Yazi', ?, ?, ?, ?)`,
    )
    .run(
      over.teamId,
      over.updatedAt,
      over.updatedAt,
      over.deletedAt ?? null,
      over.heldAt ?? null,
    );
  return Number(info.lastInsertRowid);
}

test("static sitemap keeps home, 81 il, /takimlar, /kvkk", () => {
  const entries = staticSitemapEntries(BASE, new Date("2026-09-03T00:00:00.000Z"));
  const urls = entries.map((e) => e.url);
  assert.ok(urls.includes(BASE));
  assert.ok(urls.includes(`${BASE}/takimlar`));
  assert.ok(urls.includes(`${BASE}/kvkk`));
  assert.equal(urls.filter((u) => u.includes("/il/")).length, 81);
  assert.equal(CITIES.length, 81);
  assert.ok(urls.some((u) => u.endsWith("/il/istanbul")));
});

test("25 aktif Tribün sitemap'te; inactive yok", () => {
  const db = openDb();
  seedCatalog(db);
  const forums = activeForumSitemapEntries(db, BASE);
  const urls = forums.map((e) => e.url);
  assert.equal(forums.length, 25);
  assert.equal(FORUM_ACTIVE_TEAM_IDS.length, 25);
  for (const id of FORUM_ACTIVE_TEAM_IDS) {
    assert.ok(urls.includes(`${BASE}/takim/${id}/forum`));
  }
  assert.equal(urls.some((u) => u.includes("/takim/bandirmaspor/")), false);
  assert.equal(urls.length, new Set(urls).size);
});

test("public topic sitemap'te; held/deleted/inactive team topic yok", () => {
  const db = openDb();
  seedCatalog(db);
  const liveAt = "2026-09-01T12:00:00.000Z";
  const publicId = insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: liveAt,
  });
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: liveAt,
    heldAt: liveAt,
  });
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: liveAt,
    deletedAt: liveAt,
  });
  insertTopic(db, {
    teamId: "bandirmaspor",
    updatedAt: liveAt,
  });

  const topics = publicTopicSitemapEntries(db, BASE, 1000);
  const urls = topics.map((e) => e.url);
  assert.ok(urls.includes(`${BASE}/forum/konu/${publicId}`));
  assert.equal(urls.length, 1);
  assert.equal(topics[0]?.lastModified?.toISOString(), liveAt);

  const all = buildPublicSitemap(db, BASE);
  const topicUrls = all.map((e) => e.url).filter((u) => u.includes("/forum/konu/"));
  assert.deepEqual(topicUrls, [`${BASE}/forum/konu/${publicId}`]);
});

test("private routes and post URLs are not in sitemap", () => {
  const db = openDb();
  seedCatalog(db);
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: "2026-09-02T08:00:00.000Z",
  });
  const urls = buildPublicSitemap(db, BASE).map((e) => e.url);
  for (const path of [
    "/admin",
    "/giris",
    "/uye-ol",
    "/uye-dogrula",
    "/takim-talep",
    "/dogrula",
    "/sil-verilerim",
    "/api/",
    "/forum/yeni",
    "/takim/galatasaray/forum/yeni",
  ]) {
    assert.equal(
      urls.some((u) => u.includes(path)),
      false,
      path,
    );
  }
  assert.equal(urls.some((u) => /\/forum\/posts\//.test(u)), false);
  assert.equal(urls.length, new Set(urls).size);
});

test("forum lastModified is latest public topic activity", () => {
  const db = openDb();
  seedCatalog(db);
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: "2026-08-01T00:00:00.000Z",
  });
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: "2026-09-02T15:30:00.000Z",
  });
  insertTopic(db, {
    teamId: "galatasaray",
    updatedAt: "2026-09-03T00:00:00.000Z",
    heldAt: "2026-09-03T00:00:00.000Z",
  });
  const gs = activeForumSitemapEntries(db, BASE).find((e) =>
    e.url.endsWith("/takim/galatasaray/forum"),
  );
  assert.equal(gs?.lastModified?.toISOString(), "2026-09-02T15:30:00.000Z");
  const empty = activeForumSitemapEntries(db, BASE).find((e) =>
    e.url.endsWith("/takim/fenerbahce/forum"),
  );
  assert.equal(empty?.lastModified, undefined);
});

test("topic query respects sitemap URL budget", () => {
  assert.ok(SITEMAP_MAX_URLS <= 50_000);
  const db = openDb();
  seedCatalog(db);
  const sliced = publicTopicSitemapEntries(db, BASE, 0);
  assert.equal(sliced.length, 0);
});
