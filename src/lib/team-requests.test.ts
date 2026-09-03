import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  TEAM_REQUESTS_PER_IP_HOUR,
  TEAM_REQUESTS_PER_USER_HOUR,
} from "./policy";
import {
  approveTeamRequest,
  createTeamRequest,
  isTeamRequestRateLimited,
  listTeamRequestGroups,
  parseTeamRequestCity,
  parseTeamRequestInput,
  rejectTeamRequest,
  teamRequestAdminGate,
  teamRequestSubmitGate,
} from "./team-requests";

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      league TEXT NOT NULL,
      is_forum_active INTEGER NOT NULL DEFAULT 0
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
      updated_at TEXT NOT NULL
    );
    CREATE TABLE team_requests (
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
    CREATE UNIQUE INDEX idx_team_requests_user_pending
      ON team_requests(requested_by_user_id, normalized_name)
      WHERE status = 'pending';
    CREATE TABLE moderation_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      moderator_user_id INTEGER NOT NULL REFERENCES users(id),
      target_user_id INTEGER,
      target_topic_id INTEGER,
      target_post_id INTEGER,
      action TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.prepare(
    `INSERT INTO teams (id, name, league, is_forum_active) VALUES (?, ?, ?, ?)`,
  ).run("galatasaray", "Galatasaray", "super", 1);
  return db;
}

function addUser(db: Database.Database, username: string, role = "user") {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users
       (username, username_norm, display_name, email, email_norm, password_hash,
        status, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'hash', 'active', ?, ?, ?)`,
    )
    .run(
      username,
      username,
      username,
      `${username}@ex.com`,
      `${username}@ex.com`,
      role,
      now,
      now,
    );
  return Number(info.lastInsertRowid);
}

const valid = {
  teamName: "Eskişehirspor",
  city: "Eskişehir",
  message: "Tribün kültürü güçlü, taraftar çok.",
};

test("misafir takım talebi gönderemez", () => {
  const gate = teamRequestSubmitGate(undefined);
  assert.equal(gate.ok, false);
  assert.equal(gate.status, 401);
});

test("aktif user talep gönderebilir", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const result = createTeamRequest(db, userId, valid);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, "pending");
    assert.equal(result.teamName, "Eskişehirspor");
  }
  db.close();
});

test("duplicate pending talep engellenir", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  assert.equal(createTeamRequest(db, userId, valid).ok, true);
  const second = createTeamRequest(db, userId, {
    ...valid,
    teamName: "eskisehirspor",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.status, 409);
  db.close();
});

test("mevcut takım tekrar talep edilemez", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const result = createTeamRequest(db, userId, {
    teamName: "Galatasaray",
    city: "İstanbul",
    message: "Zaten var ama yine de istiyorum.",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  db.close();
});

test("boş mesaj reddedilir", () => {
  const empty = parseTeamRequestInput({ ...valid, message: "   " });
  assert.equal(empty.ok, false);
  const missing = parseTeamRequestInput({ ...valid, message: "" });
  assert.equal(missing.ok, false);
});

test("invalid city reddedilir", () => {
  const parsed = parseTeamRequestInput({
    teamName: "Yeni Takım",
    city: "Gotham",
    message: "Bu şehir listede yok ama deniyorum.",
  });
  assert.equal(parsed.ok, false);
  assert.equal(parseTeamRequestCity("Gotham"), null);
  assert.ok(parseTeamRequestCity("Eskişehir"));
});

test("farklı kullanıcıların aynı takım için talepleri gruplanabilir", () => {
  const db = openDb();
  const ali = addUser(db, "ali");
  const berk = addUser(db, "berk");
  assert.equal(createTeamRequest(db, ali, valid).ok, true);
  assert.equal(createTeamRequest(db, berk, valid).ok, true);
  const listed = listTeamRequestGroups(db, {
    status: "pending",
    offset: 0,
    limit: 25,
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0]?.requestCount, 2);
  assert.equal(listed.items[0]?.teamName, "Eskişehirspor");
  const cityOnly = listTeamRequestGroups(db, {
    status: "pending",
    citySlug: "eskisehir",
    offset: 0,
    limit: 25,
  });
  assert.equal(cityOnly.total, 1);
  const otherCity = listTeamRequestGroups(db, {
    status: "pending",
    citySlug: "istanbul",
    offset: 0,
    limit: 25,
  });
  assert.equal(otherCity.total, 0);
  db.close();
});

test("admin pending talepleri görebilir", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  assert.equal(createTeamRequest(db, userId, valid).ok, true);
  const listed = listTeamRequestGroups(db, {
    status: "pending",
    offset: 0,
    limit: 25,
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0]?.status, "pending");
  db.close();
});

test("rate limit çalışır", () => {
  assert.equal(isTeamRequestRateLimited(0, 0), false);
  assert.equal(isTeamRequestRateLimited(TEAM_REQUESTS_PER_IP_HOUR, 0), true);
  assert.equal(isTeamRequestRateLimited(0, TEAM_REQUESTS_PER_USER_HOUR), true);
});

test("non-admin admin endpointine erişemez", () => {
  assert.equal(teamRequestAdminGate(undefined).status, 401);
  assert.equal(teamRequestAdminGate({ role: "user" }).status, 403);
  assert.equal(teamRequestAdminGate({ role: "admin" }).ok, true);
});

test("approve audit oluşturur", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const adminId = addUser(db, "mod", "admin");
  const created = createTeamRequest(db, userId, valid);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const result = approveTeamRequest(db, created.id, adminId, "uygun");
  assert.equal(result.ok, true);
  const audit = db
    .prepare(`SELECT action, reason FROM moderation_actions WHERE action = ?`)
    .get("approve_team_request") as { action: string; reason: string };
  assert.equal(audit.action, "approve_team_request");
  assert.equal(audit.reason, "uygun");
  db.close();
});

test("reject audit oluşturur", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const adminId = addUser(db, "mod", "admin");
  const created = createTeamRequest(db, userId, valid);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const result = rejectTeamRequest(db, created.id, adminId, "yetersiz gerekçe metni");
  assert.equal(result.ok, true);
  const audit = db
    .prepare(`SELECT action FROM moderation_actions WHERE action = ?`)
    .get("reject_team_request") as { action: string };
  assert.equal(audit.action, "reject_team_request");
  db.close();
});

test("reject reason zorunlu", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const adminId = addUser(db, "mod", "admin");
  const created = createTeamRequest(db, userId, valid);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const result = rejectTeamRequest(db, created.id, adminId, "  ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
  db.close();
});

test("approve duplicate team oluşturmaz", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const user2 = addUser(db, "berk");
  const adminId = addUser(db, "mod", "admin");
  db.prepare(
    `INSERT INTO teams (id, name, league, is_forum_active) VALUES (?, ?, 'bal', 0)`,
  ).run("eskisehirspor", "Eskişehirspor");

  const pending = {
    teamName: "Yenişehir FK",
    city: "Eskişehir",
    message: "Yerel tribün istiyoruz, ciddi taraftar var.",
  };
  const first = createTeamRequest(db, userId, pending);
  const second = createTeamRequest(db, user2, pending);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok) return;
  const result = approveTeamRequest(db, first.id, adminId, null);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.created, true);
  const named = (
    db
      .prepare(`SELECT COUNT(*) as c FROM teams WHERE name = ?`)
      .get("Yenişehir FK") as { c: number }
  ).c;
  assert.equal(named, 1);

  const existingReq = db
    .prepare(
      `INSERT INTO team_requests
       (requested_name, normalized_name, city_slug, message, requested_by_user_id, status, created_at)
       VALUES ('Eskişehirspor', 'eskisehirspor', 'eskisehir', 'var olan kayit', ?, 'pending', ?)`,
    )
    .run(userId, new Date().toISOString());
  const existingId = Number(existingReq.lastInsertRowid);
  const reuse = approveTeamRequest(db, existingId, adminId, null);
  assert.equal(reuse.ok, true);
  if (!reuse.ok) return;
  assert.equal(reuse.created, false);
  assert.equal(reuse.teamId, "eskisehirspor");
  assert.equal(reuse.forumActive, false);
  const copies = (
    db.prepare(`SELECT COUNT(*) as c FROM teams WHERE id LIKE 'eskisehirspor%'`).get() as {
      c: number;
    }
  ).c;
  assert.equal(copies, 1);
  db.close();
});

test("approve forumu otomatik aktive etmez", () => {
  const db = openDb();
  const userId = addUser(db, "ali");
  const adminId = addUser(db, "mod", "admin");
  const created = createTeamRequest(db, userId, valid);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const result = approveTeamRequest(db, created.id, adminId, null);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.forumActive, false);
  assert.equal(result.created, true);
  const team = db
    .prepare(`SELECT is_forum_active FROM teams WHERE id = ?`)
    .get(result.teamId) as { is_forum_active: number };
  assert.equal(team.is_forum_active, 0);
  const gs = db
    .prepare(`SELECT is_forum_active FROM teams WHERE id = 'galatasaray'`)
    .get() as { is_forum_active: number };
  assert.equal(gs.is_forum_active, 1);
  db.close();
});
