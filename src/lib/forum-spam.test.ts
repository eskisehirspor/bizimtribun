import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { moderateForumContent } from "./moderation/engine";
import { countLinks, forumFloodCheck, FORUM_MIN_SECONDS_BETWEEN_WRITES, isNewAccount } from "./forum-spam";

const NOW = new Date("2026-10-21T12:00:00Z");

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE forum_topics (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, content TEXT, created_at TEXT);
    CREATE TABLE forum_posts (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT, created_at TEXT);
  `);
  db.prepare(`INSERT INTO users (id, created_at) VALUES (1, ?)`).run("2026-01-01T00:00:00Z");
  return db;
}

function ago(seconds: number) {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

test("art arda yazı bekletilir", () => {
  const db = openDb();
  db.prepare(`INSERT INTO forum_posts (user_id, content, created_at) VALUES (1, 'ilk', ?)`).run(ago(5));
  const fast = forumFloodCheck(db, 1, "ikinci", NOW, { cooldown: true });
  assert.equal(fast.ok, false);
  assert.equal(!fast.ok && fast.status, 429);
  const later = new Date(NOW.getTime() + FORUM_MIN_SECONDS_BETWEEN_WRITES * 1000);
  assert.equal(forumFloodCheck(db, 1, "ikinci", later, { cooldown: true }).ok, true);
  db.close();
});

test("aynı yazı 24 saat içinde tekrar gönderilemez, sonra gönderilebilir", () => {
  const db = openDb();
  db.prepare(`INSERT INTO forum_topics (user_id, title, content, created_at) VALUES (1, 'B', 'Kadro  belli oldu', ?)`).run(ago(3600));
  const dup = forumFloodCheck(db, 1, "kadro belli OLDU", NOW, { cooldown: true });
  assert.equal(!dup.ok && dup.status, 409);
  assert.equal(forumFloodCheck(db, 1, "Kadro belli oldu, sol bek yok", NOW, { cooldown: true }).ok, true);
  const nextDay = new Date(NOW.getTime() + 24 * 3600_000);
  assert.equal(forumFloodCheck(db, 1, "kadro belli oldu", nextDay, { cooldown: true }).ok, true);
  // Another member may write the same words.
  assert.equal(forumFloodCheck(db, 2, "kadro belli oldu", NOW, { cooldown: true }).ok, true);
  db.close();
});

test("yeni hesap bir günden genç", () => {
  const db = openDb();
  db.prepare(`INSERT INTO users (id, created_at) VALUES (2, ?)`).run(ago(3600));
  assert.equal(isNewAccount(db, 1, NOW), false);
  assert.equal(isNewAccount(db, 2, NOW), true);
  db.close();
});

test("link sayımı", () => {
  assert.equal(countLinks("Maç özeti: https://example.com/a ve www.ornek.com.tr"), 2);
  assert.equal(countLinks("bizimtribun.com harika"), 1);
  assert.equal(countLinks("Skor 2.1 oldu, saat 20.45"), 0);
});

test("çok link ya da yeni hesaptan link moderatöre gider", () => {
  const ctx = { surface: "post" as const };
  assert.equal(moderateForumContent("Özet: https://a.com", ctx).decision, "allow");
  assert.equal(moderateForumContent("Özet: https://a.com", { ...ctx, newAccount: true }).decision, "review");
  assert.equal(moderateForumContent("https://a.com https://b.com https://c.com", ctx).decision, "review");
  assert.equal(moderateForumContent("Deneme bonusu veren siteler burada", ctx).decision, "review");
});

test("küfür filtresi: futbol dilindeki masum kelimelere dokunmaz", () => {
  const ctx = { surface: "post" as const };
  for (const text of [
    "Bu sezon savunmada ciddi sıkıntı var",
    "Amatör küme takımlarından transfer",
    "Kasımpaşa maçı zor geçecek",
    "Kaleci topu sektirdi",
    "Sıkıcı bir maçtı",
    "Picasso gibi oynadı",
    "Göteborg deplasmanı",
    "Ocak ayında transfer",
    "Şeref tribünü doluydu",
    "Dalyan'dan geldim",
    "Sgk primleri",
    "Ankara'ya deplasman",
  ]) {
    assert.equal(moderateForumContent(text, ctx).decision, "allow", text);
  }
});

test("küfür filtresi: açık küfür engellenir, hafif sözler moderatöre gider", () => {
  const ctx = { surface: "post" as const };
  for (const text of ["piç kurusu", "dalyarak hakem", "kaltak", "sürtük", "hakem s*ktir", "s.keyim", "s1kt1r git"]) {
    assert.equal(moderateForumContent(text, ctx).decision, "block", text);
  }
  for (const text of ["yavşak hakem", "şerefsiz yönetim", "göt herif", "mk", "aq hakem"]) {
    assert.equal(moderateForumContent(text, ctx).decision, "review", text);
  }
});
