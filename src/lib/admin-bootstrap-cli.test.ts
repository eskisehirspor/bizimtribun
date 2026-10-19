import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { applyDatabaseBoot } from "./db";
import { bootstrapSuperAdmin } from "./admin-bootstrap-cli";

function addUser(db: Database.Database, name: string, verified: boolean) {
  db.prepare(
    `INSERT INTO users (username, username_norm, display_name, created_at, updated_at, phone_verified_at)
     VALUES (?, ?, ?, 'x', 'x', ?)`,
  ).run(name, name, name, verified ? "2026-10-19" : null);
}

test("first super admin: only once, only a verified existing account", () => {
  const db = new Database(":memory:");
  applyDatabaseBoot(db);
  addUser(db, "kurucu", true);
  addUser(db, "ikinci", true);
  addUser(db, "dogrulanmamis", false);
  assert.equal(bootstrapSuperAdmin(db, "yok").ok, false);
  assert.equal(bootstrapSuperAdmin(db, "dogrulanmamis").ok, false);
  assert.equal(bootstrapSuperAdmin(db, "Kurucu").ok, true);
  assert.equal(bootstrapSuperAdmin(db, "ikinci").ok, false);
  const roles = db.prepare(`SELECT username, role FROM users WHERE username IN ('kurucu','ikinci')`).all();
  assert.deepEqual(roles, [
    { username: "kurucu", role: "super_admin" },
    { username: "ikinci", role: "user" },
  ]);
  assert.equal(
    (db.prepare(`SELECT COUNT(*) as c FROM audit_log WHERE action = 'super_admin_bootstrap'`).get() as { c: number }).c,
    1,
  );
  db.close();
});
