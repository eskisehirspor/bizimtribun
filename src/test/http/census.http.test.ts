import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";
import { GET as me } from "../../app/api/auth/me/route";
import { GET as statsGet } from "../../app/api/stats/route";
import { GET as fanVoteGet, POST as fanVotePost } from "../../app/api/fan-vote/route";
import { POST as phoneRequest } from "../../app/api/account/phone/request/route";
import { POST as phoneVerify } from "../../app/api/account/phone/verify/route";
import { POST as accountDelete } from "../../app/api/account/delete/route";
import { getDb } from "@/lib/db";
import { voidFanVote } from "../../lib/fan-votes";
import { OTP_MAX_ATTEMPTS, OTP_PER_PHONE_HOUR } from "../../lib/policy";
import {
  assertNoSensitiveLeak,
  authRegisterBody,
  cookies,
  freshDb,
  invoke,
  LEGAL_OK,
  legacyPasswordUser,
  setNodeEnv,
  signupCookie,
  smsSignup,
  testDevice,
  trPhone,
  uniq,
} from "./harness";

let device = testDevice();
beforeEach(async () => {
  await freshDb();
  device = testDevice();
});

let n = 0;
const phone = () => trPhone(3000 + ++n);
const name = (p = "fan") => uniq(p).slice(0, 20).toLowerCase();

async function stats() {
  const res = await invoke(statsGet, { path: "/api/stats" });
  return res.json as {
    total: number;
    teams: { id: string; votes: number }[];
    cities: Record<string, { teamId: string; votes: number; tied: boolean; coLeaderIds: string[] }>;
    standings: Record<string, { teamId: string; votes: number }[]>;
  };
}
const teamVotes = (s: Awaited<ReturnType<typeof stats>>, id: string) =>
  s.teams.find((t) => t.id === id)?.votes ?? 0;

async function sendCode(p: string, ip = "203.0.113.50") {
  return invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { phone: p }, ip });
}
async function checkCode(p: string, code: string, ip = "203.0.113.50") {
  return invoke(otpVerify, {
    method: "POST",
    path: "/api/auth/otp/verify",
    body: { phone: p, code },
    cookie: device,
    ip,
  });
}
function lastCode(res: { json: unknown }) {
  return (res.json as { devCode: string }).devCode;
}
async function ageOtps() {
  await getDb()
        .prepare(`UPDATE auth_otps SET created_at = ?`)
        .run(new Date(Date.now() - 2 * 60 * 1000).toISOString());
}

test("SMS sign-up: correct code → account, permanent vote, counters move", async () => {
  const before = await stats();
  const p = phone();
  const u = await smsSignup({ phone: p, username: name(), teamId: "eskisehirspor", city: "Eskişehir" });
  const after = await stats();
  assert.equal(after.total, before.total + 1);
  assert.equal(teamVotes(after, "eskisehirspor"), teamVotes(before, "eskisehirspor") + 1);
  assert.equal(after.cities["Eskişehir"]?.teamId, "eskisehirspor");

  const mine = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  const user = (mine.json as { user: { phoneVerified: boolean; voteTeamId: string } }).user;
  assert.equal(user.phoneVerified, true);
  assert.equal(user.voteTeamId, "eskisehirspor");
  assertNoSensitiveLeak(mine.json);

  const row = await getDb()
      .prepare(`SELECT phone_norm, phone_verified_at, email FROM users WHERE id = ?`)
      .get(u.id) as { phone_norm: string; phone_verified_at: string | null; email: string | null };
  assert.equal(row.phone_norm, p);
  assert.ok(row.phone_verified_at);
  assert.equal(row.email, null);
});

test("wrong, expired and over-tried codes are rejected", async () => {
  const p = phone();
  const sent = await sendCode(p);
  assert.equal(sent.status, 200);
  const good = lastCode(sent);
  const wrong = good === "000000" ? "111111" : "000000";

  const bad = await checkCode(p, wrong);
  assert.equal(bad.status, 400);

  await getDb().prepare(`UPDATE auth_otps SET expires_at = ?`).run("2000-01-01T00:00:00.000Z");
  const expired = await checkCode(p, good);
  assert.equal(expired.status, 400);

  await ageOtps();
  const again = await sendCode(p);
  const code2 = lastCode(again);
  const wrong2 = code2 === "000000" ? "111111" : "000000";
  for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
    await checkCode(p, wrong2, `198.51.100.${10 + i}`);
  }
  const locked = await checkCode(p, code2, "198.51.100.99");
  assert.equal(locked.status, 400, "code is void after max attempts");

  const stored = await getDb().prepare(`SELECT code_hash FROM auth_otps`).all() as { code_hash: string }[];
  for (const r of stored) assert.notEqual(r.code_hash, code2);
});

test("sign-up needs a fresh, single-use ticket and the permanent-team confirmation", async () => {
  const noTicket = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: device,
    body: { username: name(), teamId: "galatasaray", confirmTeamLocked: true, ...LEGAL_OK },
  });
  assert.equal(noTicket.status, 401);

  const p = phone();
  const code = lastCode(await sendCode(p));
  const ok = await checkCode(p, code);
  assert.equal((ok.json as { next: string }).next, "signup");
  const cookie = cookies(signupCookie(ok.res), device);

  const noConfirm = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie,
    body: { username: name(), teamId: "galatasaray", ...LEGAL_OK },
  });
  assert.equal(noConfirm.status, 400);

  const first = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie,
    body: { username: name(), teamId: "galatasaray", confirmTeamLocked: true, ...LEGAL_OK },
  });
  assert.equal(first.status, 200, first.text);
  const replay = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie,
    body: { username: name(), teamId: "fenerbahce", confirmTeamLocked: true, ...LEGAL_OK },
  });
  assert.equal(replay.status, 401);
  assert.equal((await stats()).total, 1);
});

test("same phone cannot open a second account; verifying again signs in", async () => {
  const p = phone();
  const u = await smsSignup({ phone: p, username: name() });

  // A second ticket obtained before the first sign-up finished cannot be used after it.
  await ageOtps();
  const again = await checkCode(p, lastCode(await sendCode(p)));
  assert.equal((again.json as { next: string }).next, "home");
  assert.equal(((again.json as { user: { id: number } }).user).id, u.id);

  const p2 = phone();
  const c1 = await checkCode(p2, lastCode(await sendCode(p2)));
  await ageOtps();
  const c2 = await checkCode(p2, lastCode(await sendCode(p2)));
  const one = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: cookies(signupCookie(c1.res), device),
    body: { username: name(), teamId: "galatasaray", confirmTeamLocked: true, ...LEGAL_OK },
  });
  assert.equal(one.status, 200);
  const two = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: cookies(signupCookie(c2.res), device),
    body: { username: name(), teamId: "fenerbahce", confirmTeamLocked: true, ...LEGAL_OK },
  });
  assert.equal(two.status, 409);
  const count = (
    await getDb().prepare(`SELECT COUNT(*) as c FROM users WHERE phone_norm = ?`).get(p2) as { c: number }
  ).c;
  assert.equal(count, 1);
});

test("SMS send limits: cooldown and per-phone hourly cap", async () => {
  const p = phone();
  assert.equal((await sendCode(p)).status, 200);
  const cooldown = await sendCode(p);
  assert.equal(cooldown.status, 429);
  for (let i = 1; i < OTP_PER_PHONE_HOUR; i++) {
    await ageOtps();
    assert.equal((await sendCode(p, `198.51.100.${20 + i}`)).status, 200);
  }
  await ageOtps();
  const capped = await sendCode(p, "198.51.100.60");
  assert.equal(capped.status, 429);
});

test("production: no dev SMS, no echoed code, CAPTCHA required", async () => {
  const prev = process.env.NODE_ENV;
  const prevProvider = process.env.SMS_PROVIDER;
  setNodeEnv("production");
  try {
    process.env.SMS_PROVIDER = "dev";
    const noCaptcha = await sendCode(phone());
    assert.equal(noCaptcha.status, 503, "no Turnstile secret → fail closed");
    assert.equal(JSON.stringify(noCaptcha.json).includes("devCode"), false);
    assert.equal(
      (await getDb().prepare(`SELECT COUNT(*) as c FROM auth_otps`).get() as { c: number }).c,
      0,
    );
  } finally {
    setNodeEnv(prev);
    if (prevProvider == null) delete process.env.SMS_PROVIDER;
    else process.env.SMS_PROVIDER = prevProvider;
  }
});

test("phone verification is required before voting; legacy account binds then votes once", async () => {
  const username = name("old");
  const legacy = await legacyPasswordUser({
    body: authRegisterBody({ username, email: `${username}@example.com`, phone: phone() }),
    ip: "203.0.113.70",
  });
  const denied = await invoke(fanVotePost, {
    method: "POST",
    path: "/api/fan-vote",
    cookie: legacy.cookie,
    body: { teamId: "galatasaray", confirmTeamLocked: true },
  });
  assert.equal(denied.status, 403);

  const p = phone();
  const sent = await invoke(phoneRequest, {
    method: "POST",
    path: "/api/account/phone/request",
    cookie: legacy.cookie,
    body: { phone: p },
  });
  assert.equal(sent.status, 200, sent.text);
  const bound = await invoke(phoneVerify, {
    method: "POST",
    path: "/api/account/phone/verify",
    cookie: legacy.cookie,
    body: { phone: p, code: lastCode(sent) },
  });
  assert.equal(bound.status, 200, bound.text);

  const vote = await invoke(fanVotePost, {
    method: "POST",
    path: "/api/fan-vote",
    cookie: legacy.cookie,
    body: { teamId: "trabzonspor", city: "Trabzon", confirmTeamLocked: true },
  });
  assert.equal(vote.status, 200, vote.text);
  const same = await invoke(fanVotePost, {
    method: "POST",
    path: "/api/fan-vote",
    cookie: legacy.cookie,
    body: { teamId: "trabzonspor", confirmTeamLocked: true },
  });
  assert.equal((same.json as { already: boolean }).already, true);
  const change = await invoke(fanVotePost, {
    method: "POST",
    path: "/api/fan-vote",
    cookie: legacy.cookie,
    body: { teamId: "fenerbahce", confirmTeamLocked: true },
  });
  assert.equal(change.status, 409);
  const mine = await invoke(fanVoteGet, { path: "/api/fan-vote", cookie: legacy.cookie });
  assert.equal((mine.json as { vote: { teamId: string } }).vote.teamId, "trabzonspor");
  assert.equal(teamVotes(await stats(), "trabzonspor"), 1);
  assert.equal(teamVotes(await stats(), "fenerbahce"), 0);
});

test("a phone verified on one account cannot be bound to another", async () => {
  const p = phone();
  await smsSignup({ phone: p, username: name() });
  const username = name("old");
  const legacy = await legacyPasswordUser({
    body: authRegisterBody({ username, email: `${username}@example.com`, phone: phone() }),
    ip: "203.0.113.71",
  });
  const res = await invoke(phoneRequest, {
    method: "POST",
    path: "/api/account/phone/request",
    cookie: legacy.cookie,
    body: { phone: p },
  });
  assert.equal(res.status, 409);
});

test("database refuses team changes, deletes and second votes directly", async () => {
  const u = await smsSignup({ phone: phone(), username: name(), teamId: "bursaspor", city: "Bursa" });
  const db = getDb();
  await assert.rejects(() => db.prepare(`UPDATE fan_votes SET team_id = 'galatasaray' WHERE user_id = ?`).run(u.id), /VOTE_IMMUTABLE/);
  await assert.rejects(() => db.prepare(`UPDATE fan_votes SET city = 'İstanbul' WHERE user_id = ?`).run(u.id), /VOTE_IMMUTABLE/);
  await assert.rejects(() => db.prepare(`DELETE FROM fan_votes WHERE user_id = ?`).run(u.id), /VOTE_IMMUTABLE/);
  await assert.rejects(
    () => db.prepare(`INSERT INTO fan_votes (user_id, team_id, cast_at) VALUES (?, 'galatasaray', 'x')`).run(u.id),
    /duplicate key/,
  );
  await assert.rejects(() => db.prepare(`UPDATE users SET team_id = 'galatasaray' WHERE id = ?`).run(u.id), /TEAM_LOCKED/);
  await assert.rejects(
    () =>
      db
        .prepare(`UPDATE fan_votes SET status = 'void', voided_at = 'x', void_reason = '' WHERE user_id = ?`)
        .run(u.id),
    /check constraint/,
  );
  const row = await db.prepare(`SELECT team_id, status FROM fan_votes WHERE user_id = ?`).get(u.id) as {
    team_id: string;
    status: string;
  };
  assert.deepEqual(row, { team_id: "bursaspor", status: "active" });
});

test("concurrent and cross-connection vote attempts yield exactly one vote", async () => {
  const username = name("old");
  const legacy = await legacyPasswordUser({
    body: authRegisterBody({ username, email: `${username}@example.com`, phone: phone() }),
    ip: "203.0.113.72",
  });
  await getDb().prepare(`UPDATE users SET phone_verified_at = ? WHERE id = ?`).run(new Date().toISOString(), legacy.json.user.id);
  const teams = ["galatasaray", "fenerbahce", "besiktas", "trabzonspor", "goztepe"];
  const results = await Promise.all(
    teams.map((teamId) =>
      invoke(fanVotePost, {
        method: "POST",
        path: "/api/fan-vote",
        cookie: legacy.cookie,
        body: { teamId, confirmTeamLocked: true },
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 4);

  await assert.rejects(
    () =>
      getDb()
        .prepare(`INSERT INTO fan_votes (user_id, team_id, cast_at) VALUES (?, 'goztepe', 'x')`)
        .run(legacy.json.user.id),
    /duplicate key/,
  );
  const count = (
    await getDb().prepare(`SELECT COUNT(*) as c FROM fan_votes WHERE user_id = ?`).get(legacy.json.user.id) as {
      c: number;
    }
  ).c;
  assert.equal(count, 1);
});

test("inactive or unknown teams cannot receive votes; history stays counted", async () => {
  const keep = await smsSignup({ phone: phone(), username: name(), teamId: "besiktas" });
  await getDb().prepare(`UPDATE teams SET is_active = 0 WHERE id = 'besiktas'`).run();
  assert.equal(teamVotes(await stats(), "besiktas"), 1, "deactivation keeps old votes");
  await assert.rejects(() => smsSignup({ phone: phone(), username: name(), teamId: "besiktas" }), /signup 400/);
  await assert.rejects(() => smsSignup({ phone: phone(), username: name(), teamId: "yok-boyle-takim" }), /signup 400/);
  assert.equal(
    (await getDb().prepare(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND phone_verified_at IS NOT NULL`).get() as { c: number }).c,
    1,
    "failed vote leaves no half-created account",
  );
  await assert.rejects(() => getDb().prepare(`DELETE FROM teams WHERE id = 'besiktas'`).run(), /TEAM_HAS_HISTORY/);
  assert.ok(keep.id);
});

test("account deletion voids the vote, erases PII, holds the phone for a while", async () => {
  const p = phone();
  const u = await smsSignup({ phone: p, username: name(), teamId: "samsunspor", city: "Samsun" });
  assert.equal((await stats()).total, 1);

  const bad = await invoke(accountDelete, {
    method: "POST",
    path: "/api/account/delete",
    cookie: u.cookie,
    body: { confirm: "evet" },
  });
  assert.equal(bad.status, 400);
  const del = await invoke(accountDelete, {
    method: "POST",
    path: "/api/account/delete",
    cookie: u.cookie,
    body: { confirm: "HESABIMI SİL" },
  });
  assert.equal(del.status, 200, del.text);

  const s = await stats();
  assert.equal(s.total, 0);
  assert.equal(teamVotes(s, "samsunspor"), 0);
  assert.equal(s.cities["Samsun"], undefined);
  const row = await getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(u.id) as Record<string, unknown>;
  assert.equal(row.phone_norm, null);
  assert.equal(row.phone, null);
  assert.equal(row.status, "deleted");
  assert.match(String(row.username), /^silinmis_/);
  const vote = await getDb().prepare(`SELECT status, void_reason FROM fan_votes WHERE user_id = ?`).get(u.id) as {
    status: string;
    void_reason: string;
  };
  assert.deepEqual(vote, { status: "void", void_reason: "account_deleted" });
  const sessionGone = await invoke(me, { path: "/api/auth/me", cookie: u.cookie });
  assert.equal((sessionGone.json as { user: unknown }).user, null);

  await ageOtps();
  const blocked = await checkCode(p, lastCode(await sendCode(p)));
  assert.equal(blocked.status, 409, "phone hold blocks immediate re-registration");

  await getDb().prepare(`UPDATE phone_holds SET release_at = ?`).run("2000-01-01T00:00:00.000Z");
  await ageOtps();
  await getDb().prepare(`DELETE FROM register_attempts`).run();
  await smsSignup({ phone: p, username: name(), teamId: "samsunspor", city: "Samsun" });
  assert.equal((await stats()).total, 1, "after the hold the new account's vote counts once");
  const audit = await getDb().prepare(`SELECT action FROM audit_log ORDER BY id`).all() as { action: string }[];
  assert.ok(audit.some((a) => a.action === "account_deleted"));
  assert.ok(audit.some((a) => a.action === "fan_vote_void_account_deleted"));
});

test("data correction voids a vote once, with a reason and an audit entry; never moves it", async () => {
  const u = await smsSignup({ phone: phone(), username: name(), teamId: "konyaspor" });
  const db = getDb();
  assert.equal((await voidFanVote(db, { userId: u.id, reason: "", actorUserId: null })).ok, false);
  assert.equal((await voidFanVote(db, { userId: u.id, reason: "çoklu hesap tespiti", actorUserId: null })).ok, true);
  assert.equal((await voidFanVote(db, { userId: u.id, reason: "tekrar", actorUserId: null })).ok, false);
  await assert.rejects(() => db.prepare(`UPDATE fan_votes SET status = 'active', voided_at = NULL, void_reason = NULL WHERE user_id = ?`).run(u.id), /VOTE_IMMUTABLE/);
  assert.equal(teamVotes(await stats(), "konyaspor"), 0);
  const entry = await db.prepare(`SELECT action, reason FROM audit_log WHERE action = 'fan_vote_void'`).get() as {
    action: string;
    reason: string;
  };
  assert.equal(entry.reason, "çoklu hesap tespiti");
  await assert.rejects(() => db.prepare(`DELETE FROM audit_log`).run(), /AUDIT_APPEND_ONLY/);
  await assert.rejects(() => db.prepare(`UPDATE audit_log SET reason = 'x'`).run(), /AUDIT_APPEND_ONLY/);
});

test("province ties are reported as ties, not resolved arbitrarily", async () => {
  await smsSignup({ phone: phone(), username: name(), teamId: "galatasaray", city: "Kars" });
  await smsSignup({ phone: phone(), username: name(), teamId: "fenerbahce", city: "Kars" });
  const s = await stats();
  assert.equal(s.cities["Kars"]?.tied, true);
  assert.deepEqual([...(s.cities["Kars"]?.coLeaderIds ?? [])].sort(), ["fenerbahce", "galatasaray"]);
  await smsSignup({ phone: phone(), username: name(), teamId: "fenerbahce", city: "Kars" });
  const s2 = await stats();
  assert.equal(s2.cities["Kars"]?.tied, false);
  assert.equal(s2.cities["Kars"]?.teamId, "fenerbahce");
  assert.equal(s2.cities["Ardahan"], undefined, "no votes → no leader");
});

test("username must be unique and well-formed", async () => {
  const taken = name();
  await smsSignup({ phone: phone(), username: taken });
  await assert.rejects(() => smsSignup({ phone: phone(), username: taken }), /signup 409/);
  await assert.rejects(() => smsSignup({ phone: phone(), username: "<script>" }), /signup 400/);
});
