import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { applyDatabaseBoot } from "./db";
import { CURRENT_POLL_ID } from "./policy";
import { backfillVotesFromParticipants } from "./votes";
import { SEED_DOMAIN, applyDemoVotes, isDemoRuntime } from "./seed-votes";

test("migration and vote backfill are idempotent", () => {
  const db = new Database(":memory:");
  applyDatabaseBoot(db);
  applyDatabaseBoot(db);
  const teams = (
    db.prepare(`SELECT COUNT(*) as c FROM teams WHERE is_forum_active = 1`).get() as {
      c: number;
    }
  ).c;
  assert.equal(teams, 25);
  const votesBefore = (
    db.prepare(`SELECT COUNT(*) as c FROM votes`).get() as { c: number }
  ).c;
  backfillVotesFromParticipants(db);
  const votesAfter = (
    db.prepare(`SELECT COUNT(*) as c FROM votes`).get() as { c: number }
  ).c;
  assert.equal(votesAfter, votesBefore);
  db.close();
});

test("seed production exclusion strips demo participants", () => {
  const db = new Database(":memory:");
  const prev = process.env.NODE_ENV;
  try {
    delete (process.env as { NODE_ENV?: string }).NODE_ENV;
    assert.equal(isDemoRuntime(), true);
    applyDatabaseBoot(db);
    const seeded = (
      db
        .prepare(`SELECT COUNT(*) as c FROM participants WHERE email_norm LIKE ?`)
        .get(`%@${SEED_DOMAIN}`) as { c: number }
    ).c;
    assert.ok(seeded > 0);
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    assert.equal(isDemoRuntime(), false);
    applyDemoVotes(db);
    const left = (
      db
        .prepare(`SELECT COUNT(*) as c FROM participants WHERE email_norm LIKE ?`)
        .get(`%@${SEED_DOMAIN}`) as { c: number }
    ).c;
    assert.equal(left, 0);
    const live = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM votes v
           JOIN participants p ON p.id = v.participant_id
           WHERE v.poll_id = ? AND p.email_norm LIKE ?`,
        )
        .get(CURRENT_POLL_ID, `%@${SEED_DOMAIN}`) as { c: number }
    ).c;
    assert.equal(live, 0);
  } finally {
    if (prev == null) delete (process.env as { NODE_ENV?: string }).NODE_ENV;
    else (process.env as { NODE_ENV?: string }).NODE_ENV = prev;
    db.close();
  }
});
