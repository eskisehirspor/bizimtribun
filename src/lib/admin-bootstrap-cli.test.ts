import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { applyDatabaseBoot } from "./db";
import { bootstrapSuperAdmin, bootstrapSuperAdminByEmail } from "./admin-bootstrap-cli";

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

test("first super admin by e-mail: needs a verified inbox, only once", () => {
  const db = new Database(":memory:");
  applyDatabaseBoot(db);
  const add = (name: string, emailVerified: string | null, phoneVerified: string | null) =>
    db
      .prepare(
        `INSERT INTO users (username, username_norm, display_name, email, email_norm, password_hash,
           created_at, updated_at, email_verified_at, phone_verified_at)
         VALUES (?, ?, ?, ?, ?, '', 'x', 'x', ?, ?)`,
      )
      .run(name, name, name, `${name}@ornek.com`, `${name}@ornek.com`, emailVerified, phoneVerified);
  add("telefonlu", null, "2026-10-21");
  add("kurucu", "2026-10-21", null);
  add("ikinci", "2026-10-21", null);
  assert.equal(bootstrapSuperAdminByEmail(db, "yok@ornek.com").ok, false);
  assert.equal(bootstrapSuperAdminByEmail(db, "telefonlu@ornek.com").ok, false);
  assert.equal(bootstrapSuperAdminByEmail(db, "kurucu@ornek.com").ok, true);
  assert.equal(bootstrapSuperAdminByEmail(db, "ikinci@ornek.com").ok, false);
  const roles = db
    .prepare(`SELECT username, role FROM users WHERE username IN ('telefonlu','kurucu','ikinci') ORDER BY id`)
    .all();
  assert.deepEqual(roles, [
    { username: "telefonlu", role: "user" },
    { username: "kurucu", role: "super_admin" },
    { username: "ikinci", role: "user" },
  ]);
  db.close();
});
