import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { CURRENT_POLL_ID } from "./policy";
import {
  backfillVotesFromParticipants,
  castBallot,
  liveVotesWhere,
  revokeVotesMissingPhoneVerification,
} from "./votes";

const PHONE_ON = { requirePhone: true } as const;
const PHONE_OFF = { requirePhone: false } as const;

function openDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_norm TEXT NOT NULL,
      team_id TEXT NOT NULL,
      city TEXT NOT NULL,
      verified_at TEXT,
      phone_verified_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      poll_id TEXT NOT NULL REFERENCES polls(id),
      team_id TEXT NOT NULL,
      city TEXT NOT NULL,
      cast_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE UNIQUE INDEX idx_votes_participant_poll
      ON votes(participant_id, poll_id);
  `);
  db.prepare(`INSERT INTO polls (id, title, created_at) VALUES (?, ?, ?)`).run(
    CURRENT_POLL_ID,
    "sayim",
    "2026-01-01T00:00:00.000Z",
  );
  return db;
}

function addParticipant(
  db: Database.Database,
  opts: {
    email: string;
    verified?: boolean;
    phone?: boolean;
    deleted?: boolean;
  },
) {
  const info = db
    .prepare(
      `INSERT INTO participants
       (email_norm, team_id, city, verified_at, phone_verified_at, deleted_at)
       VALUES (?, 'galatasaray', 'İstanbul', ?, ?, ?)`,
    )
    .run(
      opts.email,
      opts.verified ? "2026-01-02T00:00:00.000Z" : null,
      opts.phone ? "2026-01-03T00:00:00.000Z" : null,
      opts.deleted ? "2026-01-04T00:00:00.000Z" : null,
    );
  return Number(info.lastInsertRowid);
}

function insertVoteRow(
  db: Database.Database,
  participantId: number,
  revokedAt: string | null = null,
) {
  db.prepare(
    `INSERT INTO votes (participant_id, poll_id, team_id, city, cast_at, revoked_at)
     VALUES (?, ?, 'galatasaray', 'İstanbul', '2026-01-05T00:00:00.000Z', ?)`,
  ).run(participantId, CURRENT_POLL_ID, revokedAt);
}

function liveCount(db: Database.Database) {
  const live = liveVotesWhere();
  const row = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE ${live.sql}`,
    )
    .get(...live.params) as { c: number };
  return row.c;
}

test("email verified + phone unverified participant → backfill vote oluşturmaz", () => {
  const db = openDb();
  addParticipant(db, { email: "only@ex.com", verified: true, phone: false });
  backfillVotesFromParticipants(db, PHONE_ON);
  const n = (db.prepare(`SELECT COUNT(*) as c FROM votes`).get() as { c: number }).c;
  assert.equal(n, 0);
  db.close();
});

test("email verified + phone verified participant → backfill vote oluşturur", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "both@ex.com", verified: true, phone: true });
  backfillVotesFromParticipants(db, PHONE_ON);
  const vote = db
    .prepare(`SELECT participant_id, revoked_at FROM votes WHERE participant_id = ?`)
    .get(id) as { participant_id: number; revoked_at: string | null };
  assert.equal(vote.participant_id, id);
  assert.equal(vote.revoked_at, null);
  db.close();
});

test("mevcut email-only yanlış vote → revoke edilir", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "bad@ex.com", verified: true, phone: false });
  insertVoteRow(db, id);
  const at = "2026-09-03T12:00:00.000Z";
  const changes = revokeVotesMissingPhoneVerification(db, at, CURRENT_POLL_ID, PHONE_ON);
  assert.equal(changes, 1);
  const vote = db
    .prepare(`SELECT revoked_at FROM votes WHERE participant_id = ?`)
    .get(id) as { revoked_at: string };
  assert.equal(vote.revoked_at, at);
  db.close();
});

test("mevcut email+phone verified vote → korunur", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "ok@ex.com", verified: true, phone: true });
  insertVoteRow(db, id);
  const changes = revokeVotesMissingPhoneVerification(
    db,
    "2026-09-03T12:00:00.000Z",
    CURRENT_POLL_ID,
    PHONE_ON,
  );
  assert.equal(changes, 0);
  const vote = db
    .prepare(`SELECT revoked_at FROM votes WHERE participant_id = ?`)
    .get(id) as { revoked_at: string | null };
  assert.equal(vote.revoked_at, null);
  db.close();
});

test("revoke edilen vote istatistikte sayılmaz", () => {
  const db = openDb();
  const good = addParticipant(db, { email: "ok@ex.com", verified: true, phone: true });
  const bad = addParticipant(db, { email: "bad@ex.com", verified: true, phone: false });
  insertVoteRow(db, good);
  insertVoteRow(db, bad);
  assert.equal(liveCount(db), 2);
  revokeVotesMissingPhoneVerification(
    db,
    "2026-09-03T12:00:00.000Z",
    CURRENT_POLL_ID,
    PHONE_ON,
  );
  assert.equal(liveCount(db), 1);
  db.close();
});

test("yeni boot'ta revoke edilmiş email-only vote yeniden oluşturulmaz", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "bad@ex.com", verified: true, phone: false });
  insertVoteRow(db, id);
  revokeVotesMissingPhoneVerification(db, "2026-09-03T12:00:00.000Z", CURRENT_POLL_ID, PHONE_ON);
  backfillVotesFromParticipants(db, PHONE_ON);
  backfillVotesFromParticipants(db, PHONE_ON);
  const rows = db
    .prepare(`SELECT revoked_at FROM votes WHERE participant_id = ?`)
    .all(id) as { revoked_at: string | null }[];
  assert.equal(rows.length, 1);
  assert.ok(rows[0]?.revoked_at);
  db.close();
});

test("castBallot phone verification olmadan çalışmaz", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "no-phone@ex.com", verified: true, phone: false });
  const result = castBallot(db, id, PHONE_ON);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
  const n = (db.prepare(`SELECT COUNT(*) as c FROM votes`).get() as { c: number }).c;
  assert.equal(n, 0);
  db.close();
});

test("flag false + email verified → vote başarılı", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "launch@ex.com", verified: true, phone: false });
  const result = castBallot(db, id, PHONE_OFF);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.already, false);
  db.close();
});

test("flag false + email unverified → vote başarısız", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "raw@ex.com", verified: false, phone: false });
  const result = castBallot(db, id, PHONE_OFF);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
  db.close();
});

test("flag true + email verified + phone verified → vote başarılı", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "full@ex.com", verified: true, phone: true });
  const result = castBallot(db, id, PHONE_ON);
  assert.equal(result.ok, true);
  db.close();
});

test("flag true + email verified + phone unverified → vote başarısız", () => {
  const db = openDb();
  const id = addParticipant(db, { email: "half@ex.com", verified: true, phone: false });
  const result = castBallot(db, id, PHONE_ON);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
  db.close();
});

test("flag değişince mevcut data bozulmuyor", () => {
  const db = openDb();
  const stamp = "2026-08-01T00:00:00.000Z";
  const id = addParticipant(db, { email: "keep@ex.com", verified: true, phone: true });
  insertVoteRow(db, id);
  db.prepare(`UPDATE participants SET phone_verified_at = ? WHERE id = ?`).run(stamp, id);
  assert.equal(revokeVotesMissingPhoneVerification(db, "now", CURRENT_POLL_ID, PHONE_OFF), 0);
  const row = db
    .prepare(`SELECT phone_verified_at FROM participants WHERE id = ?`)
    .get(id) as { phone_verified_at: string };
  const vote = db
    .prepare(`SELECT revoked_at FROM votes WHERE participant_id = ?`)
    .get(id) as { revoked_at: string | null };
  assert.equal(row.phone_verified_at, stamp);
  assert.equal(vote.revoked_at, null);
  db.close();
});
