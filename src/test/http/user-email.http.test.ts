import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as me } from "../../app/api/auth/me/route";
import { POST as verifyEmail } from "../../app/api/auth/verify-email/route";
import { POST as resendVerification } from "../../app/api/auth/resend-verification/route";
import { GET as listTopics, POST as createTopic } from "../../app/api/forum/teams/[teamSlug]/topics/route";
import { GET as getTopic } from "../../app/api/forum/topics/[topicId]/route";
import { POST as createPost } from "../../app/api/forum/topics/[topicId]/posts/route";
import { POST as adminBan } from "../../app/api/admin/users/[id]/ban/route";
import { getDb } from "@/lib/db";
import {
  FORUM_PHONE_UNVERIFIED_ERROR,
  USER_EMAIL_RESEND_PER_USER_HOUR,
} from "../../lib/policy";
import { USER_VERIFY_ALREADY, issueUserEmailToken } from "../../lib/user-email";
import {
  TEST_PASSWORD,
  authRegisterBody,
  legacyPasswordUser,
  freshDb,
  invoke,
  markEmailVerified,
  castTestVote,
  markPhoneVerified,
  sessionCookie,
  trPhone,
  uniq,
} from "./harness";

const ALLOW = {
  title: "Derbi analizi temiz",
  content: "Rakip kaleci büyük hata yaptı, defans da çok açıktı.",
};

beforeEach(async () => {
  await freshDb();
});

let n = 0;
async function registerUnverified(ip: string) {
  n += 1;
  const username = uniq("ev").slice(0, 20);
  const email = `${username}@example.com`;
  const res = await legacyPasswordUser({ body: authRegisterBody({
      username,
      email,
      phone: trPhone(8000 + n),
    }), ip });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  return {
    username,
    email,
    id: (res.json as { user: { id: number } }).user.id,
    cookie: sessionCookie(res.res),
    json: res.json,
    res: res.res,
  };
}

async function ageResendAttempts() {
  await getDb()
        .prepare(`UPDATE register_attempts SET created_at = ?`)
        .run(new Date(Date.now() - 2 * 60 * 1000).toISOString());
}

test("legacy account: email unverified; token only stored hashed", async () => {
  const u = await registerUnverified("203.0.113.201");
  const raw = await issueUserEmailToken(u.id);

  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal(mine.status, 200);
  const meUser = (mine.json as { user: { emailVerified: boolean } }).user;
  assert.equal(meUser.emailVerified, false);
  assert.equal(JSON.stringify(mine.json).includes('"email"'), false);

  const stored = await getDb()
      .prepare(`SELECT token_hash FROM user_email_tokens WHERE user_id = ?`)
      .all(u.id) as { token_hash: string }[];
  assert.ok(stored.length >= 1);
  const dumped = JSON.stringify(u.json);
  assert.equal(dumped.includes("token_hash"), false);
  for (const row of stored) {
    assert.equal(dumped.includes(row.token_hash), false);
    assert.notEqual(row.token_hash, raw);
  }
});

test("verify token valid → verified; replay reject; expired reject", async () => {
  const u = await registerUnverified("203.0.113.202");
  const token = await issueUserEmailToken(u.id);
  const hashes = await getDb()
      .prepare(`SELECT token_hash FROM user_email_tokens WHERE user_id = ?`)
      .all(u.id) as { token_hash: string }[];
  assert.equal(hashes.some((r) => r.token_hash === token), false);
  const ok = await invoke(verifyEmail, {
    method: "POST",
    path: "/api/auth/verify-email",
    body: { token },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(JSON.stringify(ok.json).includes(token), false);

  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal(
    (mine.json as { user: { emailVerified: boolean } }).user.emailVerified,
    true,
  );

  const replay = await invoke(verifyEmail, {
    method: "POST",
    path: "/api/auth/verify-email",
    body: { token },
  });
  assert.equal(replay.status, 400);

  const other = await registerUnverified("203.0.113.203");
  const raw = await issueUserEmailToken(other.id);
  await getDb()
        .prepare(`UPDATE user_email_tokens SET expires_at = ? WHERE user_id = ?`)
        .run("2000-01-01T00:00:00.000Z", other.id);
  const expired = await invoke(verifyEmail, {
    method: "POST",
    path: "/api/auth/verify-email",
    body: { token: raw },
  });
  assert.equal(expired.status, 400);
});

test("unverified user: no team tribune, POST topic/post 403; verified fan mutation ok", async () => {
  const u = await registerUnverified("203.0.113.204");
  const list = await invoke(listTopics, {
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
  });
  // No vote yet, so no team tribune.
  assert.equal(list.status, 403);
  const seedId = (
    await getDb().prepare(`SELECT id FROM forum_topics WHERE team_id = 'galatasaray' LIMIT 1`).get() as { id: number }
  ).id;
  assert.ok(seedId);

  const topic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: ALLOW,
  });
  assert.equal(topic.status, 403);
  assert.equal((topic.json as { error: string }).error, FORUM_PHONE_UNVERIFIED_ERROR);

  const reply = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${seedId}/posts`,
    params: { topicId: String(seedId) },
    cookie: u.cookie,
    body: { content: ALLOW.content },
  });
  assert.equal(reply.status, 403);
  assert.equal((reply.json as { error: string }).error, FORUM_PHONE_UNVERIFIED_ERROR);

  await markPhoneVerified(u.id);

  await castTestVote(u.id);
  const got = await invoke(getTopic, {
    path: `/api/forum/topics/${seedId}`,
    params: { topicId: String(seedId) },
    cookie: u.cookie,
  });
  assert.equal(got.status, 200);
  const created = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: ALLOW,
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
});

test("resend cooldown, rate limit, verified skip", async () => {
  const u = await registerUnverified("203.0.113.205");
  const first = await invoke(resendVerification, {
    method: "POST",
    path: "/api/auth/resend-verification",
    cookie: u.cookie,
    ip: "203.0.113.205",
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(
    JSON.stringify(first.json).includes("token"),
    false,
  );

  const cool = await invoke(resendVerification, {
    method: "POST",
    path: "/api/auth/resend-verification",
    cookie: u.cookie,
    ip: "203.0.113.205",
  });
  assert.equal(cool.status, 429);

  await ageResendAttempts();
  for (let i = 1; i < USER_EMAIL_RESEND_PER_USER_HOUR; i++) {
    const again = await invoke(resendVerification, {
      method: "POST",
      path: "/api/auth/resend-verification",
      cookie: u.cookie,
      ip: "203.0.113.205",
    });
    assert.equal(again.status, 200, `resend ${i} ${JSON.stringify(again.json)}`);
    await ageResendAttempts();
  }
  const limited = await invoke(resendVerification, {
    method: "POST",
    path: "/api/auth/resend-verification",
    cookie: u.cookie,
    ip: "203.0.113.205",
  });
  assert.equal(limited.status, 429);

  const v = await registerUnverified("203.0.113.206");
  await markEmailVerified(v.id);
  const before = (
    await getDb()
            .prepare(
              `SELECT COUNT(*) as c FROM user_email_tokens WHERE user_id = ?`,
            )
            .get(v.id) as { c: number }
  ).c;
  const skip = await invoke(resendVerification, {
    method: "POST",
    path: "/api/auth/resend-verification",
    cookie: v.cookie,
    ip: "203.0.113.206",
  });
  assert.equal(skip.status, 200);
  assert.equal((skip.json as { message: string }).message, USER_VERIFY_ALREADY);
  const after = (
    await getDb()
            .prepare(
              `SELECT COUNT(*) as c FROM user_email_tokens WHERE user_id = ?`,
            )
            .get(v.id) as { c: number }
  ).c;
  assert.equal(after, before);
});

test("banned + unverified forum error is ban, not email", async () => {
  const u = await registerUnverified("203.0.113.207");
  const admin = await registerUnverified("203.0.113.208");
  const adminLogin = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: admin.username, password: TEST_PASSWORD },
    ip: "203.0.113.208",
  });
  await getDb()
        .prepare(`UPDATE users SET role = 'admin', totp_enabled = 1 WHERE id = ?`)
        .run(admin.id);
  const ban = await invoke(adminBan, {
    method: "POST",
    path: `/api/admin/users/${u.id}/ban`,
    params: { id: String(u.id) },
    cookie: sessionCookie(adminLogin.res),
    body: { reason: "Küfür ve tehdit" },
  });
  assert.equal(ban.status, 200, JSON.stringify(ban.json));

  const topic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: u.cookie,
    body: ALLOW,
  });
  assert.ok(topic.status === 401 || topic.status === 403);
  if (topic.status === 403) {
    assert.notEqual(
      (topic.json as { error: string }).error,
      FORUM_PHONE_UNVERIFIED_ERROR,
    );
  }
});
