import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GET as dashboard } from "../../app/api/admin/dashboard/route";
import { GET as audit } from "../../app/api/admin/audit/route";
import { GET as heldList } from "../../app/api/admin/moderation/held/route";
import { GET as usersList } from "../../app/api/admin/users/route";
import { GET as userDetail } from "../../app/api/admin/users/[id]/route";
import { POST as banRoute } from "../../app/api/admin/users/[id]/ban/route";
import { PUT as roleRoute } from "../../app/api/admin/users/[id]/role/route";
import { DELETE as voidVote } from "../../app/api/admin/users/[id]/vote/route";
import { GET as stats } from "../../app/api/stats/route";
import { getDb } from "@/lib/db";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(async () => {
  await freshDb();
});

let n = 0;
async function member(role: "user" | "moderator" | "admin" | "super_admin" = "user") {
  n += 1;
  const u = await smsSignup({
    phone: trPhone(7000 + n),
    username: uniq("r").slice(0, 20),
    ip: `198.51.100.${n % 250}`,
  });
  if (role !== "user") {
    await getDb().prepare(`UPDATE users SET role = ?, totp_enabled = 1 WHERE id = ?`).run(role, u.id);
  }
  return u;
}

function setRole(cookie: string, id: number, role: string) {
  return invoke(roleRoute, {
    method: "PUT",
    path: `/api/admin/users/${id}/role`,
    cookie,
    params: { id: String(id) },
    body: { role, reason: "test rol değişikliği" },
  });
}

test("moderator reaches moderation but not dashboard, audit or roles", async () => {
  const mod = await member("moderator");
  const target = await member();

  assert.equal((await invoke(heldList, { path: "/api/admin/moderation/held", cookie: mod.cookie })).status, 200);
  assert.equal((await invoke(usersList, { path: "/api/admin/users", cookie: mod.cookie })).status, 200);
  assert.equal((await invoke(dashboard, { path: "/api/admin/dashboard", cookie: mod.cookie })).status, 403);
  assert.equal((await invoke(audit, { path: "/api/admin/audit", cookie: mod.cookie })).status, 403);
  assert.equal((await setRole(mod.cookie, target.id, "moderator")).status, 403);
  const voided = await invoke(voidVote, {
    method: "DELETE",
    path: `/api/admin/users/${target.id}/vote`,
    cookie: mod.cookie,
    params: { id: String(target.id) },
    body: { reason: "deneme" },
  });
  assert.equal(voided.status, 403);
});

test("moderator sees masked personal data only", async () => {
  const mod = await member("moderator");
  const target = await member();
  const res = await invoke(userDetail, {
    path: `/api/admin/users/${target.id}`,
    cookie: mod.cookie,
    params: { id: String(target.id) },
  });
  assert.equal(res.status, 200);
  const user = (res.json as { user: Record<string, unknown> }).user;
  assert.equal(user.phone, undefined);
  assert.match(String(user.phoneMasked), /\*\*\*/);
  assert.ok(!res.text.includes(trPhone(7000 + n)));
  assert.equal(user.firstName, null);
});

test("moderator bans a member but not another moderator", async () => {
  const mod = await member("moderator");
  const other = await member("moderator");
  const plain = await member();
  const ban = (id: number) =>
    invoke(banRoute, {
      method: "POST",
      path: `/api/admin/users/${id}/ban`,
      cookie: mod.cookie,
      params: { id: String(id) },
      body: { reason: "kural ihlali" },
    });
  assert.equal((await ban(plain.id)).status, 200);
  assert.notEqual((await ban(other.id)).status, 200);
  const row = await getDb()
      .prepare(`SELECT action, target_type, target_id FROM audit_log WHERE action = 'ban_user'`)
      .get() as { action: string; target_type: string; target_id: string };
  assert.equal(row.target_id, String(plain.id));
});

test("only super admin changes roles, never their own", async () => {
  const admin = await member("admin");
  const superA = await member("super_admin");
  const target = await member();

  assert.equal((await setRole(admin.cookie, target.id, "moderator")).status, 403);

  const promoted = await setRole(superA.cookie, target.id, "admin");
  assert.equal(promoted.status, 200, promoted.text);
  const row = await getDb().prepare(`SELECT role FROM users WHERE id = ?`).get(target.id) as { role: string };
  assert.equal(row.role, "admin");
  const revoked = await getDb()
      .prepare(`SELECT COUNT(*) as c FROM sessions WHERE user_id = ? AND revoked_at IS NULL`)
      .get(target.id) as { c: number };
  assert.equal(revoked.c, 0);

  assert.equal((await setRole(superA.cookie, superA.id, "admin")).status, 409);

  const second = await member("super_admin");
  const demoted = await setRole(second.cookie, superA.id, "admin");
  assert.equal(demoted.status, 200, demoted.text);
  // Demotion revoked superA's sessions; the old cookie no longer works.
  assert.equal((await setRole(superA.cookie, target.id, "user")).status, 401);
  const audits = await getDb()
      .prepare(`SELECT action FROM audit_log WHERE action LIKE 'role_%' ORDER BY id`)
      .all() as { action: string }[];
  assert.deepEqual(
    audits.map((a) => a.action),
    ["role_user_to_admin", "role_super_admin_to_admin"],
  );
});

test("staff roles need a phone-verified account", async () => {
  const superA = await member("super_admin");
  const target = await member();
  await getDb().prepare(`UPDATE users SET phone_verified_at = NULL WHERE id = ?`).run(target.id);
  assert.equal((await setRole(superA.cookie, target.id, "moderator")).status, 409);
});

test("admin voids a vote: it stops counting, stays on its team, is audited", async () => {
  const admin = await member("admin");
  const fan = await member();
  const before = (await invoke(stats, { path: "/api/stats" })).json as { total: number };

  const res = await invoke(voidVote, {
    method: "DELETE",
    path: `/api/admin/users/${fan.id}/vote`,
    cookie: admin.cookie,
    params: { id: String(fan.id) },
    body: { reason: "sahte hesap tespiti" },
  });
  assert.equal(res.status, 200, res.text);

  const after = (await invoke(stats, { path: "/api/stats" })).json as { total: number };
  assert.equal(after.total, before.total - 1);
  const vote = await getDb()
      .prepare(`SELECT team_id, status, voided_by_user_id FROM fan_votes WHERE user_id = ?`)
      .get(fan.id) as { team_id: string; status: string; voided_by_user_id: number };
  assert.deepEqual(vote, { team_id: "galatasaray", status: "void", voided_by_user_id: admin.id });
  const entry = await getDb()
      .prepare(`SELECT actor_user_id, reason FROM audit_log WHERE action = 'admin_fan_vote_void'`)
      .get() as { actor_user_id: number; reason: string };
  assert.equal(entry.actor_user_id, admin.id);

  const again = await invoke(voidVote, {
    method: "DELETE",
    path: `/api/admin/users/${fan.id}/vote`,
    cookie: admin.cookie,
    params: { id: String(fan.id) },
    body: { reason: "ikinci deneme" },
  });
  assert.equal(again.status, 409);
});
