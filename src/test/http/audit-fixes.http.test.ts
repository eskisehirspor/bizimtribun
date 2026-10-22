import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { DELETE as adminDeleteTopic } from "../../app/api/admin/forum/topics/[id]/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { POST as block } from "../../app/api/account/blocks/route";
import { PATCH as patchProfile } from "../../app/api/account/profile/route";
import { GET as dashboard } from "../../app/api/admin/dashboard/route";
import { GET as totpStatus } from "../../app/api/admin/security/totp/route";
import { DELETE as voidVote, POST as restoreVote } from "../../app/api/admin/users/[id]/vote/route";
import { getDb } from "@/lib/db";
import { safeNextPath } from "@/lib/forum-ui";
import { isReservedName } from "@/lib/name";
import { banUser } from "@/lib/users";
import { deleteAccount } from "@/lib/accounts";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(async () => {
  await freshDb();
});

let n = 0;
async function member(role: "user" | "moderator" | "admin" | "super_admin" = "user") {
  n += 1;
  const u = await smsSignup({ phone: trPhone(6100 + n), username: uniq("af").slice(0, 20), ip: `192.0.2.${100 + (n % 100)}` });
  if (role !== "user") await getDb().prepare(`UPDATE users SET role = ?, totp_enabled = 1 WHERE id = ?`).run(role, u.id);
  return u;
}

const TOPIC = { title: "Transfer dedikoduları", content: "Bu yaz kim gelir, kim gider?" };

async function topic(cookie: string) {
  const res = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie, body: TOPIC });
  assert.equal(res.status, 201, res.text);
  return (res.json as { topic: { id: number } }).topic.id;
}

test("login redirect stays on the site", () => {
  for (const bad of ["/\\evil.com", "//evil.com", "https://evil.com", "/\u0000x", "/\tx"]) {
    assert.equal(safeNextPath(bad), "/takimlar", JSON.stringify(bad));
  }
  assert.equal(safeNextPath("/forum/genel?x=1"), "/forum/genel?x=1");
});

test("moderators can't remove an admin's topic", async () => {
  const admin = await member("admin");
  const mod = await member("moderator");
  const id = await topic(admin.cookie);
  const res = await invoke(adminDeleteTopic, {
    method: "DELETE",
    path: `/api/admin/forum/topics/${id}`,
    params: { id: String(id) },
    cookie: mod.cookie,
    body: { reason: "deneme gerekçesi" },
  });
  assert.equal(res.status, 403);
});

test("a blocked member can't like the blocker's content", async () => {
  const a = await member();
  const b = await member();
  const id = await topic(a.cookie);
  const blocked = await invoke(block, { method: "POST", path: "/api/account/blocks", cookie: a.cookie, body: { userId: b.id, blocked: true } });
  assert.equal(blocked.status, 200, blocked.text);
  const res = await invoke(like, { method: "POST", path: "/api/forum/likes", cookie: b.cookie, body: { type: "topic", id, liked: true } });
  assert.equal(res.status, 403);
});

test("profile names can't pose as staff; deleted accounts can't be banned", async () => {
  assert.equal(isReservedName("Bizim Tribün Yönetimi"), true);
  assert.equal(isReservedName("Kartal 1903"), false);
  const u = await member();
  const res = await invoke(patchProfile, {
    method: "PATCH",
    path: "/api/account/profile",
    cookie: u.cookie,
    body: { displayName: "Moderatör Ekibi" },
  });
  assert.equal(res.status, 400);
  await getDb().prepare(`UPDATE users SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), u.id);
  assert.equal((await banUser(u.id, "test")).ok, false);
});

test("staff without 2FA reach only their security settings", async () => {
  const admin = await member("admin");
  await getDb().prepare(`UPDATE users SET totp_enabled = 0 WHERE id = ?`).run(admin.id);
  const dash = await invoke(dashboard, { path: "/api/admin/dashboard", cookie: admin.cookie });
  assert.equal(dash.status, 403);
  assert.match((dash.json as { error: string }).error, /2FA/);
  const status = await invoke(totpStatus, { path: "/api/admin/security/totp", cookie: admin.cookie });
  assert.equal(status.status, 200, status.text);
});

test("deleting an account holds the number: a year after a vote, for good after a ban", async () => {
  const voter = await member();
  const banned = await member();
  assert.equal((await banUser(banned.id, "kural ihlali")).ok, true);
  for (const u of [voter, banned]) {
    assert.equal((await deleteAccount(getDb(), { userId: u.id, actorUserId: u.id, reason: "test" })).ok, true);
  }
  const holds = await getDb().prepare(`SELECT reason, release_at FROM phone_holds ORDER BY created_at`).all() as {
    reason: string;
    release_at: string;
  }[];
  const byReason = Object.fromEntries(holds.map((h) => [h.reason, h.release_at]));
  const days = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86_400_000;
  assert.ok(days(byReason.account_deleted_voted!) > 360);
  assert.equal(byReason.account_deleted_banned, "9999-12-31T00:00:00.000Z");
});

test("only a super admin can undo a voided vote, and only with a record", async () => {
  const fan = await member();
  const admin = await member("admin");
  const boss = await member("super_admin");
  const call = (handler: typeof voidVote, method: string, cookie: string) =>
    invoke(handler, {
      method,
      path: `/api/admin/users/${fan.id}/vote`,
      params: { id: String(fan.id) },
      cookie,
      body: { reason: "yanlışlıkla iptal edildi" },
    });
  const voided = await call(voidVote, "DELETE", admin.cookie);
  assert.equal(voided.status, 200, voided.text);

  // A direct write can't bring the vote back without a restore record.
  await assert.rejects(
    () => getDb().prepare(`UPDATE fan_votes SET status = 'active', restored_at = ? WHERE user_id = ?`).run(new Date().toISOString(), fan.id),
    /VOTE_IMMUTABLE/,
  );
  assert.equal((await call(restoreVote, "POST", admin.cookie)).status, 403);
  const restored = await call(restoreVote, "POST", boss.cookie);
  assert.equal(restored.status, 200, restored.text);
  const vote = await getDb().prepare(`SELECT status, team_id, restored_at FROM fan_votes WHERE user_id = ?`).get(fan.id) as {
    status: string;
    team_id: string;
    restored_at: string | null;
  };
  assert.equal(vote.status, "active");
  assert.equal(vote.team_id, "galatasaray");
  assert.ok(vote.restored_at);
  assert.equal((await call(restoreVote, "POST", boss.cookie)).status, 409);

  // A deleted account's vote stays void.
  const gone = await member();
  assert.equal((await deleteAccount(getDb(), { userId: gone.id, actorUserId: gone.id, reason: "test" })).ok, true);
  const res = await invoke(restoreVote, {
    method: "POST",
    path: `/api/admin/users/${gone.id}/vote`,
    params: { id: String(gone.id) },
    cookie: boss.cookie,
    body: { reason: "geri getir" },
  });
  assert.equal(res.status, 409);
});
