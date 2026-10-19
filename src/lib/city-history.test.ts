import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { cityHistory } from "./city-stats";
import { getDb, resetDbForTests } from "./db";

process.env.BIZIM_TRIBUN_TEST = "1";
process.env.APP_SECRET ||= "city-history-test-secret-32-chars!";

test("weekly history is rebuilt from cast_at / voided_at, ties included", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-hist-"));
  process.env.BIZIM_TRIBUN_DB = path.join(dir, "t.db");
  resetDbForTests();
  const db = getDb();
  const now = Date.parse("2026-10-19T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const iso = (ms: number) => new Date(ms).toISOString();
  // The fan_votes insert trigger requires phone-verified users.
  const addUser = (name: string) =>
    Number(
      db
        .prepare(
          `INSERT INTO users (username, username_norm, display_name, created_at, updated_at, phone_verified_at)
           VALUES (?, ?, ?, 'x', 'x', 'x')`,
        )
        .run(name, name, name).lastInsertRowid,
    );
  const vote = (name: string, team: string, castMs: number) => {
    const id = addUser(name);
    db.prepare(`UPDATE users SET team_id = ? WHERE id = ?`).run(team, id);
    db.prepare(
      `INSERT INTO fan_votes (user_id, team_id, city, cast_at, status) VALUES (?, ?, 'Eskişehir', ?, 'active')`,
    ).run(id, team, iso(castMs));
    return id;
  };
  vote("a", "eskisehirspor", now - 20 * day);
  vote("b", "galatasaray", now - 10 * day);
  const c = vote("c", "galatasaray", now - 3 * day);
  db.prepare(
    `UPDATE fan_votes SET status = 'void', voided_at = ?, void_reason = 'test' WHERE user_id = ?`,
  ).run(iso(now - 1 * day), c);

  const h = cityHistory("Eskişehir", 4, now);
  assert.deepEqual(
    h.map((p) => [p.total, p.leaderIds.join("=")]),
    [
      [0, ""], // 3 weeks ago: nothing yet
      [1, "eskisehirspor"], // 2 weeks ago
      [2, "eskisehirspor=galatasaray"], // 1 week ago: tie, no leader picked
      [2, "eskisehirspor=galatasaray"], // now: c was voided yesterday
    ],
  );
  // Two days ago, before the void, c still counted.
  const before = cityHistory("Eskişehir", 1, now - 2 * day);
  assert.deepEqual([before[0]!.total, before[0]!.leaderIds], [3, ["galatasaray"]]);
});
