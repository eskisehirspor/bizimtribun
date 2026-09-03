import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GET as adminDashboard } from "../../app/api/admin/dashboard/route";
import { GET as adminUsers } from "../../app/api/admin/users/route";
import { GET as adminUser } from "../../app/api/admin/users/[id]/route";
import { POST as adminBan } from "../../app/api/admin/users/[id]/ban/route";
import { GET as adminBans } from "../../app/api/admin/bans/route";
import { GET as adminModeration } from "../../app/api/admin/moderation/route";
import { GET as adminHeld } from "../../app/api/admin/moderation/held/route";
import { GET as adminTopics } from "../../app/api/admin/forum/topics/route";
import { GET as adminPosts } from "../../app/api/admin/forum/posts/route";
import { GET as adminTeamRequests } from "../../app/api/admin/team-requests/route";
import { GET as adminTotp } from "../../app/api/admin/security/totp/route";
import { POST as totpSetup } from "../../app/api/admin/security/totp/setup/route";
import { POST as totpVerify } from "../../app/api/admin/security/totp/verify/route";
import { POST as login2fa } from "../../app/api/auth/login/2fa/route";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as logout } from "../../app/api/auth/logout/route";
import { GET as me } from "../../app/api/auth/me/route";
import { POST as register } from "../../app/api/auth/register/route";
import { POST as forumTopic } from "../../app/api/forum/teams/[teamSlug]/topics/route";
import { getDb } from "@/lib/db";
import { AUTH_LOGIN_PER_ID_HOUR, AUTH_REGISTER_PER_HOUR, SESSION_COOKIE } from "../../lib/policy";
import { totpAt } from "../../lib/totp";
import {
  TEST_PASSWORD,
  admin2faCookie,
  authRegisterBody,
  cookieFlags,
  freshDb,
  invoke,
  setNodeEnv,
  sessionCookie,
  setCookies,
  uniq,
  trPhone,
} from "./harness";

const ADMIN_GETS: Array<{
  name: string;
  handler: typeof adminDashboard;
  path: string;
  params?: Record<string, string>;
}> = [
  { name: "dashboard", handler: adminDashboard, path: "/api/admin/dashboard" },
  { name: "users", handler: adminUsers, path: "/api/admin/users" },
  { name: "bans", handler: adminBans, path: "/api/admin/bans" },
  { name: "moderation", handler: adminModeration, path: "/api/admin/moderation" },
  { name: "held", handler: adminHeld, path: "/api/admin/moderation/held" },
  { name: "forum-topics", handler: adminTopics, path: "/api/admin/forum/topics" },
  { name: "forum-posts", handler: adminPosts, path: "/api/admin/forum/posts" },
  {
    name: "team-requests",
    handler: adminTeamRequests,
    path: "/api/admin/team-requests",
  },
  { name: "totp", handler: adminTotp, path: "/api/admin/security/totp" },
];

beforeEach(() => {
  freshDb();
});

async function registerUser(ip?: string) {
  const username = uniq("usr").slice(0, 20);
  const email = `${username}@example.com`;
  const phone = trPhone(seqPhone());
  const res = await invoke(register, {
    method: "POST",
    path: "/api/auth/register",
    body: authRegisterBody({ username, email, phone }),
    ip,
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  return {
    username,
    email,
    phone,
    cookie: sessionCookie(res.res),
    json: res.json as { user: { id: number; role: string } },
    res: res.res,
  };
}

let phoneN = 0;
function seqPhone() {
  phoneN += 1;
  return phoneN;
}

async function promoteAdmin(userId: number) {
  getDb()
    .prepare(`UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), userId);
}

test("HTTP auth: register → login → /api/auth/me", async () => {
  const u = await registerUser();
  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal(mine.status, 200);
  const body = mine.json as { ok: boolean; user: { username: string } };
  assert.equal(body.ok, true);
  assert.equal(body.user.username, u.username);

  const logged = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip: "203.0.113.20",
  });
  assert.equal(logged.status, 200);
  const again = await invoke(me, {
    path: "/api/auth/me",
    cookie: sessionCookie(logged.res),
  });
  assert.equal((again.json as { user: { username: string } }).user.username, u.username);
});

test("HTTP auth: logout session geçersiz", async () => {
  const u = await registerUser("203.0.113.21");
  const out = await invoke(logout, {
    method: "POST",
    path: "/api/auth/logout",
    cookie: u.cookie,
    ip: "203.0.113.21",
  });
  assert.equal(out.status, 200);
  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal((mine.json as { user: unknown }).user, null);
});

test("HTTP auth: expired session protected mutation 401", async () => {
  const u = await registerUser("203.0.113.22");
  getDb()
    .prepare(`UPDATE sessions SET expires_at = ?`)
    .run("2000-01-01T00:00:00.000Z");
  const topic = await invoke(forumTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: {
      title: "Derbi analizi temiz",
      content: "Rakip kaleci büyük hata yaptı, defans da çok açıktı.",
    },
  });
  assert.equal(topic.status, 401);
});

test("HTTP auth: banned user login 403 ve mevcut session mutation 403", async () => {
  const u = await registerUser("203.0.113.23");
  const admin = await registerUser("203.0.113.24");
  await promoteAdmin(admin.json.user.id);
  const adminLogin = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.24",
  });
  const ban = await invoke(adminBan, {
    method: "POST",
    path: `/api/admin/users/${u.json.user.id}/ban`,
    params: { id: String(u.json.user.id) },
    cookie: sessionCookie(adminLogin.res),
    body: { reason: "Küfür ve tehdit" },
  });
  assert.equal(ban.status, 200, JSON.stringify(ban.json));

  const bannedLogin = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip: "203.0.113.25",
  });
  assert.equal(bannedLogin.status, 403);

  const topic = await invoke(forumTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: {
      title: "Derbi analizi temiz",
      content: "Rakip kaleci büyük hata yaptı, defans da çok açıktı.",
    },
  });
  assert.ok(topic.status === 403 || topic.status === 401);
});

test("HTTP admin: unauthenticated 401, user 403, admin 200", async () => {
  const user = await registerUser("203.0.113.26");
  const admin = await registerUser("203.0.113.27");
  await promoteAdmin(admin.json.user.id);
  const adminLogin = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.27",
  });
  const adminCookie = sessionCookie(adminLogin.res);

  for (const route of ADMIN_GETS) {
    const anon = await invoke(route.handler, { path: route.path });
    assert.equal(anon.status, 401, route.name);
    const denied = await invoke(route.handler, {
      path: route.path,
      cookie: user.cookie,
    });
    assert.equal(denied.status, 403, route.name);
    const ok = await invoke(route.handler, {
      path: route.path,
      cookie: adminCookie,
    });
    assert.equal(ok.status, 200, `${route.name} ${JSON.stringify(ok.json)}`);
  }
});

test("HTTP admin IDOR: olmayan kullanıcı 404", async () => {
  const admin = await registerUser("203.0.113.28");
  await promoteAdmin(admin.json.user.id);
  const adminLogin = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.28",
  });
  const cookie = sessionCookie(adminLogin.res);
  const missing = await invoke(adminUser, {
    path: "/api/admin/users/999999",
    params: { id: "999999" },
    cookie,
  });
  assert.equal(missing.status, 404);
  const bad = await invoke(adminUser, {
    path: "/api/admin/users/abc",
    params: { id: "abc" },
    cookie,
  });
  assert.equal(bad.status, 404);
});

test("HTTP admin 2FA: kapalı login session, açık password-only session yok, TOTP", async () => {
  const admin = await registerUser("203.0.113.29");
  await promoteAdmin(admin.json.user.id);
  const first = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.29",
  });
  assert.equal(first.status, 200);
  assert.equal((first.json as { need2fa?: boolean }).need2fa, undefined);
  assert.ok(sessionCookie(first.res));

  const setup = await invoke(totpSetup, {
    method: "POST",
    path: "/api/admin/security/totp/setup",
    cookie: sessionCookie(first.res),
  });
  assert.equal(setup.status, 200, JSON.stringify(setup.json));
  const secret = (setup.json as { secret: string }).secret;
  const code = totpAt(secret, Date.now())!;
  const confirm = await invoke(totpVerify, {
    method: "POST",
    path: "/api/admin/security/totp/verify",
    cookie: sessionCookie(first.res),
    body: { code },
  });
  assert.equal(confirm.status, 200, JSON.stringify(confirm.json));

  await invoke(logout, {
    method: "POST",
    path: "/api/auth/logout",
    cookie: sessionCookie(first.res),
  });

  const pwOnly = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.30",
  });
  assert.equal(pwOnly.status, 200);
  assert.equal((pwOnly.json as { need2fa: boolean }).need2fa, true);
  assert.equal(cookieValueSafe(pwOnly.res, SESSION_COOKIE), null);

  const wrong = await invoke(login2fa, {
    method: "POST",
    path: "/api/auth/login/2fa",
    cookie: admin2faCookie(pwOnly.res),
    body: { code: "000000" },
    ip: "203.0.113.30",
  });
  assert.equal(wrong.status, 401);

  const goodCode = totpAt(secret, Date.now())!;
  const good = await invoke(login2fa, {
    method: "POST",
    path: "/api/auth/login/2fa",
    cookie: admin2faCookie(pwOnly.res),
    body: { code: goodCode },
    ip: "203.0.113.30",
  });
  assert.equal(good.status, 200, JSON.stringify(good.json));
  assert.ok(sessionCookie(good.res));

  const pwOnly2 = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.31",
  });
  getDb()
    .prepare(`UPDATE admin_login_challenges SET expires_at = ?`)
    .run("2000-01-01T00:00:00.000Z");
  const expired = await invoke(login2fa, {
    method: "POST",
    path: "/api/auth/login/2fa",
    cookie: admin2faCookie(pwOnly2.res),
    body: { code: totpAt(secret, Date.now())! },
    ip: "203.0.113.31",
  });
  assert.equal(expired.status, 401);
});

test("HTTP auth register rate limit", async () => {
  const ip = "198.51.100.9";
  for (let i = 0; i < AUTH_REGISTER_PER_HOUR; i++) {
    const username = uniq("rl").slice(0, 20);
    const res = await invoke(register, {
      method: "POST",
      path: "/api/auth/register",
      ip,
      body: authRegisterBody({
        username,
        email: `${username}@example.com`,
        phone: trPhone(8000 + i),
      }),
    });
    assert.equal(res.status, 200, JSON.stringify(res.json));
  }
  const blocked = await invoke(register, {
    method: "POST",
    path: "/api/auth/register",
    ip,
    body: authRegisterBody({
      username: uniq("rlx").slice(0, 20),
      email: `${uniq("e")}@example.com`,
      phone: trPhone(8099),
    }),
  });
  assert.equal(blocked.status, 429);
});

test("HTTP auth login rate limit", async () => {
  const u = await registerUser("203.0.113.42");
  const ip = "198.51.100.44";
  let last = 0;
  for (let i = 0; i < AUTH_LOGIN_PER_ID_HOUR; i++) {
    const res = await invoke(login, {
      method: "POST",
      path: "/api/auth/login",
      ip,
      body: { login: u.username, password: "Wrong1!x" },
    });
    last = res.status;
    assert.ok(res.status === 401 || res.status === 429);
  }
  const blocked = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    ip,
    body: { login: u.username, password: "Wrong1!x" },
  });
  assert.equal(blocked.status, 429);
  assert.ok(last === 401 || last === 429);
});

test("HTTP session cookie HttpOnly SameSite", async () => {
  const u = await registerUser("203.0.113.40");
  const flags = cookieFlags(setCookies(u.res), SESSION_COOKIE);
  assert.ok(flags);
  assert.equal(flags.httpOnly, true);
  assert.equal(flags.sameSite?.toLowerCase(), "lax");
  assert.equal(flags.secure, false);
});

test("HTTP production session cookie Secure", async () => {
  const prev = process.env.NODE_ENV;
  setNodeEnv("production");
  try {
    const username = uniq("prd").slice(0, 20);
    const res = await invoke(register, {
      method: "POST",
      path: "/api/auth/register",
      ip: "203.0.113.41",
      body: authRegisterBody({
        username,
        email: `${username}@example.com`,
        phone: trPhone(9001),
      }),
    });
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const flags = cookieFlags(setCookies(res.res), SESSION_COOKIE);
    assert.equal(flags?.secure, true);
    assert.equal(flags?.httpOnly, true);
  } finally {
    setNodeEnv(prev);
  }
});

function cookieValueSafe(res: Response, name: string) {
  const lines = setCookies(res);
  for (const line of lines) {
    const part = line.split(";")[0] || "";
    if (part.startsWith(`${name}=`)) {
      const v = part.slice(name.length + 1);
      return v || null;
    }
  }
  return null;
}
