import assert from "node:assert/strict";
import { test } from "node:test";
import { freshTestDb } from "./db-test";
import type { Db } from "./db";
import { bootstrapSuperAdmin, bootstrapSuperAdminByEmail } from "./admin-bootstrap-cli";

async function addUser(db: Db, name: string, verified: boolean) {
  await db.prepare(
        `INSERT INTO users (username, username_norm, display_name, created_at, updated_at, phone_verified_at)
     VALUES (?, ?, ?, 'x', 'x', ?)`,
      ).run(name, name, name, verified ? "2026-10-19" : null);
}

test("first super admin: only once, only a verified existing account", async () => {
  const db = await freshTestDb();
  await addUser(db, "kurucu", true);
  await addUser(db, "ikinci", true);
  await addUser(db, "dogrulanmamis", false);
  assert.equal((await bootstrapSuperAdmin(db, "yok")).ok, false);
  assert.equal((await bootstrapSuperAdmin(db, "dogrulanmamis")).ok, false);
  assert.equal((await bootstrapSuperAdmin(db, "Kurucu")).ok, true);
  assert.equal((await bootstrapSuperAdmin(db, "ikinci")).ok, false);
  const roles = await db.prepare(`SELECT username, role FROM users WHERE username IN ('kurucu','ikinci') ORDER BY id`).all();
  assert.deepEqual(roles, [
    { username: "kurucu", role: "super_admin" },
    { username: "ikinci", role: "user" },
  ]);
  assert.equal(
    (await db.prepare(`SELECT COUNT(*) as c FROM audit_log WHERE action = 'super_admin_bootstrap'`).get() as { c: number }).c,
    1,
  );
});

test("first super admin by e-mail: needs a verified inbox, only once", async () => {
  const db = await freshTestDb();
  const add = (name: string, emailVerified: string | null, phoneVerified: string | null) =>
    db
      .prepare(
        `INSERT INTO users (username, username_norm, display_name, email, email_norm, password_hash,
           created_at, updated_at, email_verified_at, phone_verified_at)
         VALUES (?, ?, ?, ?, ?, '', 'x', 'x', ?, ?)`,
      )
      .run(name, name, name, `${name}@ornek.com`, `${name}@ornek.com`, emailVerified, phoneVerified);
  await add("telefonlu", null, "2026-10-21");
  await add("kurucu", "2026-10-21", null);
  await add("ikinci", "2026-10-21", null);
  assert.equal((await bootstrapSuperAdminByEmail(db, "yok@ornek.com")).ok, false);
  assert.equal((await bootstrapSuperAdminByEmail(db, "telefonlu@ornek.com")).ok, false);
  assert.equal((await bootstrapSuperAdminByEmail(db, "kurucu@ornek.com")).ok, true);
  assert.equal((await bootstrapSuperAdminByEmail(db, "ikinci@ornek.com")).ok, false);
  const roles = await db
      .prepare(`SELECT username, role FROM users WHERE username IN ('telefonlu','kurucu','ikinci') ORDER BY id`)
      .all();
  assert.deepEqual(roles, [
    { username: "telefonlu", role: "user" },
    { username: "kurucu", role: "super_admin" },
    { username: "ikinci", role: "user" },
  ]);
});
