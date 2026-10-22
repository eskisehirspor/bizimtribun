import assert from "node:assert/strict";
import { test } from "node:test";
import { scratchDb } from "./db-test";
import { moderateForumContent } from "./moderation/engine";
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_DEFAULT,
  FORUM_CATEGORY_META,
  isForumCategory,
  parseForumCategoryInput,
  parseForumCategoryParam,
  sortTopicsForBoard,
  topicOrderSql,
} from "./forum-category";

test("her tribünde aynı 10 başlık, verilen sırayla", () => {
  assert.deepEqual(
    FORUM_CATEGORIES.map((c) => FORUM_CATEGORY_META[c].label),
    [
      "Genel Sohbet",
      "Maç Gündemi",
      "Takım Kadrosu ve Oyuncular",
      "Teknik Direktör ve Taktik",
      "Kulüp Yönetimi",
      "Altyapı ve Genç Yetenekler",
      "Tribün ve Taraftar Kültürü",
      "Deplasman ve Organizasyon",
      "Kulüp Tarihi ve Efsaneler",
      "Kulüp Haberleri ve Duyurular",
    ],
  );
  for (const cat of FORUM_CATEGORIES) {
    assert.equal(isForumCategory(cat), true);
    assert.equal(parseForumCategoryParam(cat).ok, true);
    assert.equal(parseForumCategoryInput(cat, null).ok, true);
  }
});

test("geçersiz kategori reddedilir", () => {
  assert.equal(isForumCategory("atisma"), false);
  assert.equal(parseForumCategoryParam("atisma").ok, false);
  assert.equal(parseForumCategoryInput("atisma", FORUM_CATEGORY_DEFAULT).ok, false);
  assert.equal(parseForumCategoryInput(1, FORUM_CATEGORY_DEFAULT).ok, false);
});

test("POST kategori yoksa Genel Sohbet", () => {
  const parsed = parseForumCategoryInput(undefined, FORUM_CATEGORY_DEFAULT);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.category, "genel-sohbet");
});

test("eski kategori linkleri yeni başlığa gider", () => {
  assert.deepEqual(parseForumCategoryParam("gundem"), { ok: true, category: "genel-sohbet" });
  assert.deepEqual(parseForumCategoryParam("mac-gunu"), { ok: true, category: "mac-gundemi" });
  assert.deepEqual(parseForumCategoryParam("anilar"), { ok: true, category: "kulup-tarihi" });
  // New topics can't be filed under an old category.
  assert.equal(parseForumCategoryInput("gundem", null).ok, false);
});

test("yeni konu doğru kategoriye kaydolur ve filtre çalışır", async () => {
  const db = await scratchDb();
  await db.exec(`
    CREATE TABLE forum_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'gundem',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      held_at TEXT
    );
  `);
  const insert = db.prepare(
    `INSERT INTO forum_topics (team_id, title, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  await insert.run("gs", "Transfer", "gundem", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
  await insert.run("gs", "Otobüs", "deplasman", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
  const created = await db
      .prepare(`SELECT category FROM forum_topics WHERE title = ?`)
      .get("Otobüs") as { category: string };
  assert.equal(created.category, "deplasman");

  const filtered = await db
      .prepare(
        `SELECT title FROM forum_topics t
       WHERE t.team_id = ? AND t.deleted_at IS NULL AND t.held_at IS NULL AND t.category = ?`,
      )
      .all("gs", "deplasman") as { title: string }[];
  assert.deepEqual(
    filtered.map((r) => r.title),
    ["Otobüs"],
  );
});

test("pinned sıralaması doğru", () => {
  const rows = [
    {
      title: "yeni",
      isPinned: false,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      title: "sabit-eski",
      isPinned: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      title: "aktif",
      isPinned: false,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ];
  const activity = sortTopicsForBoard(rows, "activity").map((r) => r.title);
  assert.deepEqual(activity, ["sabit-eski", "aktif", "yeni"]);
  const newest = sortTopicsForBoard(rows, "newest").map((r) => r.title);
  assert.deepEqual(newest, ["sabit-eski", "yeni", "aktif"]);
  assert.match(topicOrderSql("activity"), /is_pinned DESC/);
});

test("moderation bütün kategorilerde aynen çalışır", () => {
  const ctx = { surface: "topic" as const, userId: 1 };
  for (const cat of FORUM_CATEGORIES) {
    const blocked = moderateForumContent("Bu hakem orospu gibi yönetiyor.", {
      ...ctx,
      teamId: cat,
    });
    assert.equal(blocked.decision, "block");
    const clean = moderateForumContent("İlk maçım İnönü'deydi, skor 2-1.", {
      ...ctx,
      teamId: cat,
    });
    assert.equal(clean.decision, "allow");
  }
});
