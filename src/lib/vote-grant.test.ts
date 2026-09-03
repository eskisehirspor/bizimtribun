import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  participantMeetsVoteVerification,
  parsePhoneVerificationEnabled,
} from "./phone-verification";
import { VOTE_GRANT_COOKIE, VOTE_GRANT_TTL_MS } from "./policy";
import { castBallot } from "./votes";
import { CURRENT_POLL_ID } from "./policy";
import {
  DOGRULA_PUBLIC_PATH,
  consumeVoteGrant,
  errorOmitsSecret,
  issueVoteGrant,
  lookupVoteGrant,
  publicVoteStatus,
  urlLeaksVoteGrant,
  voteGrantCookieOptions,
  voteGrantFromCookieHeader,
  voteGrantTokenHash,
} from "./vote-grant";

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
      participant_id INTEGER NOT NULL,
      poll_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      city TEXT NOT NULL,
      cast_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE UNIQUE INDEX idx_votes_participant_poll
      ON votes(participant_id, poll_id);
    CREATE TABLE vote_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
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
  opts: { verified?: boolean; phone?: boolean } = {},
) {
  const info = db
    .prepare(
      `INSERT INTO participants
       (email_norm, team_id, city, verified_at, phone_verified_at, deleted_at)
       VALUES ('a@b.com', 'galatasaray', 'İstanbul', ?, ?, NULL)`,
    )
    .run(
      opts.verified === false ? null : "2026-01-02T00:00:00.000Z",
      opts.phone ? "2026-01-03T00:00:00.000Z" : null,
    );
  return Number(info.lastInsertRowid);
}

test("verification sonrası URL'de grant yok", () => {
  assert.equal(urlLeaksVoteGrant("https://bizimtribun.com/dogrula?token=abc"), false);
  assert.equal(urlLeaksVoteGrant("https://bizimtribun.com/dogrula?grant=1.deadbeef"), true);
  assert.equal(urlLeaksVoteGrant("https://bizimtribun.com/api/vote?grant=x"), true);
  assert.equal(DOGRULA_PUBLIC_PATH.includes("grant"), false);
  assert.equal(DOGRULA_PUBLIC_PATH.includes("?"), false);
});

test("grant browser history'ye düşmüyor", () => {
  assert.equal(DOGRULA_PUBLIC_PATH, "/dogrula");
  assert.equal(urlLeaksVoteGrant(`https://x.example${DOGRULA_PUBLIC_PATH}`), false);
});

test("invalid/expired grant reddediliyor", () => {
  const db = openDb();
  const pid = addParticipant(db);
  assert.equal(lookupVoteGrant(db, "nope").ok, false);
  const issued = issueVoteGrant(db, pid);
  db.prepare(`UPDATE vote_grants SET expires_at = ?`).run("2000-01-01T00:00:00.000Z");
  const expired = lookupVoteGrant(db, issued.raw);
  assert.equal(expired.ok, false);
  db.close();
});

test("grant replay reddediliyor", () => {
  const db = openDb();
  const pid = addParticipant(db);
  const issued = issueVoteGrant(db, pid);
  const first = lookupVoteGrant(db, issued.raw);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(consumeVoteGrant(db, first.grant.id), true);
  const again = lookupVoteGrant(db, issued.raw);
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.ok(again.grant.consumedAt);
  assert.equal(consumeVoteGrant(db, again.grant.id), false);
  db.close();
});

test("GET /api/vote grant ile team/city sızdırmıyor", () => {
  const unseen = publicVoteStatus({
    emailVerified: true,
    phoneVerified: false,
    phoneVerificationRequired: false,
    voted: false,
    teamId: "galatasaray",
    city: "İstanbul",
    castAt: null,
  });
  assert.equal("teamId" in unseen, false);
  assert.equal("city" in unseen, false);
  assert.equal(unseen.voted, false);
  const seen = publicVoteStatus({
    emailVerified: true,
    phoneVerified: true,
    phoneVerificationRequired: true,
    voted: true,
    teamId: "galatasaray",
    city: "İstanbul",
    castAt: "2026-09-03T00:00:00.000Z",
  });
  assert.equal(seen.teamId, "galatasaray");
  assert.equal(seen.city, "İstanbul");
});

test("phone verification false iken email verified kullanıcı güvenli şekilde vote aşamasına geçiyor", () => {
  assert.equal(parsePhoneVerificationEnabled("false"), false);
  const row = { verified_at: "t", phone_verified_at: null };
  assert.equal(participantMeetsVoteVerification(row, false), true);
  const db = openDb();
  const pid = addParticipant(db, { verified: true, phone: false });
  const issued = issueVoteGrant(db, pid);
  const looked = lookupVoteGrant(db, issued.raw);
  assert.equal(looked.ok, true);
  if (!looked.ok) return;
  const ballot = castBallot(db, looked.grant.participantId, { requirePhone: false });
  assert.equal(ballot.ok, true);
  if (ballot.ok) consumeVoteGrant(db, looked.grant.id);
  db.close();
});

test("phone verification true iken telefon doğrulaması olmadan vote mümkün değil", () => {
  const row = { verified_at: "t", phone_verified_at: null };
  assert.equal(participantMeetsVoteVerification(row, true), false);
  const db = openDb();
  const pid = addParticipant(db, { verified: true, phone: false });
  const issued = issueVoteGrant(db, pid);
  const looked = lookupVoteGrant(db, issued.raw);
  assert.equal(looked.ok, true);
  if (!looked.ok) return;
  const ballot = castBallot(db, looked.grant.participantId, { requirePhone: true });
  assert.equal(ballot.ok, false);
  if (!ballot.ok) assert.equal(ballot.status, 403);
  const still = lookupVoteGrant(db, issued.raw);
  assert.equal(still.ok, true);
  if (still.ok) assert.equal(still.grant.consumedAt, null);
  db.close();
});

test("Referrer/token leak senaryosu", () => {
  const secret = "a".repeat(64);
  assert.equal(errorOmitsSecret("Token yok.", secret), true);
  assert.equal(errorOmitsSecret(`bad ${secret}`, secret), false);
  const opts = voteGrantCookieOptions(1800);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/api/vote");
  assert.equal(opts.maxAge, 1800);
  assert.ok(VOTE_GRANT_TTL_MS <= 60 * 60 * 1000);
  const dir = dirname(fileURLToPath(import.meta.url));
  const cfg = readFileSync(join(dir, "../../next.config.ts"), "utf8");
  assert.match(cfg, /dogrula/);
  assert.match(cfg, /no-referrer/);
  const page = readFileSync(join(dir, "../app/dogrula/page.tsx"), "utf8");
  assert.equal(page.includes("grant:"), false);
  assert.match(page, /replaceState/);
  const cookie = `${VOTE_GRANT_COOKIE}=${encodeURIComponent("abc")}; Path=/api/vote`;
  assert.equal(voteGrantFromCookieHeader(cookie), "abc");
  assert.equal(voteGrantTokenHash("x").length, 64);
});

test("mevcut vote flow bozulmuyor", () => {
  const db = openDb();
  const pid = addParticipant(db, { verified: true, phone: true });
  const first = castBallot(db, pid, { requirePhone: true });
  assert.equal(first.ok, true);
  const second = castBallot(db, pid, { requirePhone: true });
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.already, true);
  db.close();
});
