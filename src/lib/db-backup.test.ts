import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  backupRetentionCount,
  backupSqliteFile,
  pruneBackups,
  restoreSqliteFile,
} from "./db-backup";
import { sqliteIntegrityCheck, sqliteQuickCheck } from "./db-health";

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bt-bak-"));
}

function seedFile(file: string, marker: string) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)`);
  db.prepare(`INSERT INTO t (v) VALUES (?)`).run(marker);
  db.close();
}

test("backup uses WAL-safe snapshot, integrity_check, restore, retention", () => {
  const dir = scratch();
  const live = path.join(dir, "live.db");
  const destDir = path.join(dir, "backups");
  seedFile(live, "alpha");

  const bak = path.join(destDir, "bizim-tribun-1.sqlite");
  backupSqliteFile(live, bak);
  const snap = new Database(bak, { readonly: true });
  assert.equal(sqliteIntegrityCheck(snap), true);
  assert.equal(sqliteQuickCheck(snap), true);
  assert.equal(
    (snap.prepare(`SELECT v FROM t`).get() as { v: string }).v,
    "alpha",
  );
  snap.close();

  const liveDb = new Database(live);
  liveDb.prepare(`UPDATE t SET v = ?`).run("beta");
  liveDb.close();

  const target = path.join(dir, "restored.db");
  restoreSqliteFile(bak, target);
  const restored = new Database(target, { readonly: true });
  assert.equal(sqliteIntegrityCheck(restored), true);
  assert.equal(
    (restored.prepare(`SELECT v FROM t`).get() as { v: string }).v,
    "alpha",
  );
  restored.close();

  fs.mkdirSync(destDir, { recursive: true });
  for (let i = 0; i < 4; i++) {
    const extra = path.join(destDir, `bizim-tribun-${i}.sqlite`);
    if (extra === bak) continue;
    fs.copyFileSync(bak, extra);
    const t = Date.now() - i * 1000;
    fs.utimesSync(extra, t / 1000, t / 1000);
  }
  assert.equal(backupRetentionCount({}), 7);
  assert.equal(backupRetentionCount({ DB_BACKUP_RETENTION: "3" }), 3);
  pruneBackups(destDir, 2);
  const left = fs.readdirSync(destDir).filter((n) => n.endsWith(".sqlite"));
  assert.equal(left.length, 2);
});
