import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as register } from "../../app/api/auth/register/route";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as me } from "../../app/api/auth/me/route";
import { POST as createTopic } from "../../app/api/forum/teams/[teamSlug]/topics/route";
import { POST as adminBan } from "../../app/api/admin/users/[id]/ban/route";
import { getDb } from "@/lib/db";
import { banUser } from "@/lib/users";
import {
  TEST_PASSWORD,
  authRegisterBody,
  freshDb,
  invoke,
  markEmailVerified,
  sessionCookie,
  trPhone,
  uniq,
} from "./harness";

const ALLOW = {
  title: "Derbi analizi temiz",
  content: "Rakip kaleci büyük hata yaptı, defans da çok açıktı.",
};

beforeEach(() => {
  freshDb();
});

let n = 0;

async function verifiedUser(ip: string) {
  n += 1;
  const username = uniq("ban").slice(0, 20);
  const res = await invoke(register, {
    method: "POST",
    path: "/api/auth/register",
    ip,
    body: authRegisterBody({
      username,
      email: `${username}@example.com`,
      phone: trPhone(5000 + n),
    }),
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const id = (res.json as { user: { id: number } }).user.id;
  markEmailVerified(id);
  return {
    id,
    username,
    cookie: sessionCookie(res.res),
  };
}

async function adminCookie(ip: string) {
  const u = await verifiedUser(ip);
  getDb()
    .prepare(`UPDATE users SET role = 'admin' WHERE id = ?`)
    .run(u.id);
  const logged = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  return { cookie: sessionCookie(logged.res), id: u.id };
}

function expireBan(userId: number) {
  getDb()
    .prepare(
      `UPDATE users SET ban_expires_at = ? WHERE id = ?`,
    )
    .run("2000-01-01T00:00:00.000Z", userId);
}

test("HTTP ban expiry: active ban blocks login and forum", async () => {
  const ip = "203.0.113.160";
  const u = await verifiedUser(ip);
  banUser(u.id, "Test ban", "2099-01-01T00:00:00.000Z");

  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal(mine.status, 200);
  assert.equal((mine.json as { user: unknown }).user, null);

  const loginAttempt = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  assert.equal(loginAttempt.status, 403);

  const topic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: ALLOW,
    ip,
  });
  assert.ok(topic.status === 401 || topic.status === 403);
});

test("HTTP ban expiry: expired ban → /api/auth/me active after login", async () => {
  const ip = "203.0.113.161";
  const u = await verifiedUser(ip);
  banUser(u.id, "Geçici ban", "2099-01-01T00:00:00.000Z");
  expireBan(u.id);

  const stale = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal((stale.json as { user: unknown }).user, null);

  const logged = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  assert.equal(logged.status, 200, JSON.stringify(logged.json));
  assert.equal((logged.json as { user: { status: string } }).user.status, "active");

  const mine = await invoke(me, {
    path: "/api/auth/me",
    cookie: sessionCookie(logged.res),
  });
  assert.equal(mine.status, 200);
  assert.equal((mine.json as { user: { status: string } }).user.status, "active");

  const stored = getDb()
    .prepare(`SELECT status, banned_at, ban_expires_at FROM users WHERE id = ?`)
    .get(u.id) as {
    status: string;
    banned_at: string | null;
    ban_expires_at: string | null;
  };
  assert.equal(stored.status, "active");
  assert.equal(stored.banned_at, null);
  assert.equal(stored.ban_expires_at, null);
});

test("HTTP ban expiry: expired ban ile forum mutation mümkün", async () => {
  const ip = "203.0.113.162";
  const u = await verifiedUser(ip);
  banUser(u.id, "Geçici ban", "2099-01-01T00:00:00.000Z");
  expireBan(u.id);

  const logged = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  assert.equal(logged.status, 200);

  const topic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: sessionCookie(logged.res),
    body: ALLOW,
    ip,
  });
  assert.ok(topic.status === 200 || topic.status === 201, JSON.stringify(topic.json));
});

test("HTTP ban expiry: revoked session ban sonrası otomatik restore edilmez", async () => {
  const ip = "203.0.113.163";
  const u = await verifiedUser(ip);
  banUser(u.id, "Geçici ban", "2099-01-01T00:00:00.000Z");
  expireBan(u.id);

  const stale = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal((stale.json as { user: unknown }).user, null);

  const revoked = getDb()
    .prepare(
      `SELECT revoked_at FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(u.id) as { revoked_at: string | null };
  assert.ok(revoked.revoked_at);
});

test("HTTP ban expiry: kalıcı ban süresiz banned kalır", async () => {
  const ip = "203.0.113.164";
  const u = await verifiedUser(ip);
  const admin = await adminCookie("203.0.113.165");
  const banned = await invoke(adminBan, {
    method: "POST",
    path: `/api/admin/users/${u.id}/ban`,
    params: { id: String(u.id) },
    cookie: admin.cookie,
    body: { reason: "Kalıcı ban test" },
  });
  assert.equal(banned.status, 200);

  const loginAttempt = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  assert.equal(loginAttempt.status, 403);
});
