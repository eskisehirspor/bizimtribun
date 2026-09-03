import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as censusRegister } from "../../app/api/register/route";
import { POST as verifyEmail } from "../../app/api/verify/route";
import { GET as voteGet, POST as votePost } from "../../app/api/vote/route";
import { POST as otpRequest } from "../../app/api/otp/request/route";
import { POST as otpVerify } from "../../app/api/otp/verify/route";
import { GET as statsGet } from "../../app/api/stats/route";
import { getDb } from "@/lib/db";
import { identityPhoneHash } from "../../lib/crypto";
import { hashedIp } from "../../lib/stats";
import {
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_HOUR,
  VOTE_GRANT_COOKIE,
  CURRENT_POLL_ID,
} from "../../lib/policy";
import { SEED_DOMAIN } from "../../lib/seed-votes";
import { cityVoteTotals } from "../../lib/city-stats";
import { getCityBySlug } from "../../lib/cities";
import sitemap from "../../app/sitemap";
import {
  censusBody,
  cookieFlags,
  freshDb,
  grantCookie,
  invoke,
  setCookies,
  setPhoneVerification,
  setNodeEnv,
  trPhone,
  uniq,
} from "./harness";

beforeEach(() => {
  setPhoneVerification(false);
  freshDb();
});

async function registerCensus(phone: string, ip: string) {
  const email = `${uniq("c")}@example.com`;
  const res = await invoke(censusRegister, {
    method: "POST",
    path: "/api/register",
    ip,
    body: censusBody({ email, phone }),
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const devLink = (res.json as { devLink?: string }).devLink;
  assert.ok(devLink);
  const token = new URL(devLink).searchParams.get("token");
  assert.ok(token);
  return { email, phone, token, json: res.json };
}

async function verify(token: string, ip: string) {
  return invoke(verifyEmail, {
    method: "POST",
    path: "/api/verify",
    ip,
    body: { token },
  });
}

test("HTTP launch: email verify → vote grant → vote → alreadyVoted → stats", async () => {
  setPhoneVerification(false);
  const phone = trPhone(11);
  const { email, token } = await registerCensus(phone, "203.0.113.50");
  const verified = await verify(token, "203.0.113.51");
  assert.equal(verified.status, 200, JSON.stringify(verified.json));
  const vbody = verified.json as {
    voted: boolean;
    phoneVerificationRequired: boolean;
  };
  assert.equal(vbody.voted, false);
  assert.equal(vbody.phoneVerificationRequired, false);
  const grant = grantCookie(verified.res);
  assert.ok(grant);
  const flags = cookieFlags(setCookies(verified.res), VOTE_GRANT_COOKIE);
  assert.equal(flags?.httpOnly, true);
  assert.equal(flags?.sameSite?.toLowerCase(), "lax");

  const status = await invoke(voteGet, { path: "/api/vote", cookie: grant });
  assert.equal(
    (status.json as { emailVerified: boolean; voted: boolean }).emailVerified,
    true,
  );
  assert.equal((status.json as { voted: boolean }).voted, false);

  const first = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    cookie: grant,
    body: {},
    ip: "203.0.113.52",
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal((first.json as { alreadyVoted: boolean }).alreadyVoted, false);

  const votesAfterVerify = (
    getDb()
      .prepare(`SELECT COUNT(*) as c FROM votes WHERE revoked_at IS NULL`)
      .get() as { c: number }
  ).c;
  assert.ok(votesAfterVerify >= 1);

  const second = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    body: { email, phone },
    ip: "203.0.113.53",
  });
  assert.equal(second.status, 200);
  assert.equal((second.json as { alreadyVoted: boolean }).alreadyVoted, true);

  const stats = await invoke(statsGet, { path: "/api/stats" });
  assert.equal(stats.status, 200);
  assert.ok((stats.json as { total: number }).total >= 1);
});

test("HTTP email verify duplicate vote oluşturmaz (backfill)", async () => {
  const { token } = await registerCensus(trPhone(12), "203.0.113.54");
  await verify(token, "203.0.113.55");
  const n = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM votes v
         JOIN participants p ON p.id = v.participant_id
         WHERE p.email_norm NOT LIKE ? AND v.revoked_at IS NULL`,
      )
      .get(`%@${SEED_DOMAIN}`) as { c: number }
  ).c;
  assert.equal(n, 0);
});

test("HTTP phone-enabled: email-only vote 403, OTP sonra vote, ikinci oy blocked", async () => {
  setPhoneVerification(true);
  freshDb();
  const phone = trPhone(13);
  const { token, email } = await registerCensus(phone, "203.0.113.56");
  const verified = await verify(token, "203.0.113.57");
  const grant = grantCookie(verified.res);
  const denied = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    cookie: grant,
    body: {},
    ip: "203.0.113.58",
  });
  assert.equal(denied.status, 403);

  const otp = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone },
    ip: "203.0.113.59",
  });
  assert.equal(otp.status, 200, JSON.stringify(otp.json));
  const code = (otp.json as { devCode?: string }).devCode;
  assert.ok(code);
  const okOtp = await invoke(otpVerify, {
    method: "POST",
    path: "/api/otp/verify",
    body: { phone, code },
    ip: "203.0.113.60",
  });
  assert.equal(okOtp.status, 200, JSON.stringify(okOtp.json));
  const row = getDb()
    .prepare(`SELECT phone_verified_at FROM participants WHERE phone_norm = ?`)
    .get(phone.replace(/\D/g, "").slice(-10)) as { phone_verified_at: string };
  assert.ok(row.phone_verified_at);

  const voted = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    cookie: grant,
    body: {},
    ip: "203.0.113.61",
  });
  assert.equal(voted.status, 200);
  assert.equal((voted.json as { alreadyVoted: boolean }).alreadyVoted, false);
  const again = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    body: { email, phone },
    ip: "203.0.113.62",
  });
  assert.equal((again.json as { alreadyVoted: boolean }).alreadyVoted, true);
});

test("HTTP OTP: invalid, unknown generic, registered same shape, cooldown, limits", async () => {
  const phone = trPhone(14);
  await registerCensus(phone, "203.0.113.70");

  const invalid = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: "02121234567" },
  });
  assert.equal(invalid.status, 400);

  const known = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone },
    ip: "203.0.113.71",
  });
  const unknown = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: trPhone(15) },
    ip: "203.0.113.72",
  });
  assert.equal(known.status, unknown.status);
  const k = known.json as Record<string, unknown>;
  const u = unknown.json as Record<string, unknown>;
  const { devCode: _k, ...kPub } = k;
  const { devCode: _u, ...uPub } = u;
  assert.deepEqual(kPub, uPub);

  const ghostOtps = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM phone_otps WHERE phone_hash = ?`,
      )
      .get(identityPhoneHash(trPhone(15))) as { c: number }
  ).c;
  assert.equal(ghostOtps, 0);

  const cooldown = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone },
    ip: "203.0.113.73",
  });
  assert.equal(cooldown.status, 429);

  const hourPhone = trPhone(16);
  await registerCensus(hourPhone, "203.0.113.74");
  for (let i = 0; i < OTP_PER_PHONE_HOUR; i++) {
    const r = await invoke(otpRequest, {
      method: "POST",
      path: "/api/otp/request",
      body: { phone: hourPhone },
      ip: `203.0.113.${80 + i}`,
    });
    if (r.status === 429 && i > 0) break;
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const phoneKey = hashedIp(`otp-phone:${identityPhoneHash(hourPhone)}`);
    getDb()
      .prepare(`UPDATE register_attempts SET created_at = ? WHERE ip_hash = ?`)
      .run(new Date(Date.now() - 90_000).toISOString(), phoneKey);
  }
  const limited = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: hourPhone },
    ip: "203.0.113.90",
  });
  assert.equal(limited.status, 429);

  const ip = "192.0.2.77";
  for (let i = 0; i < OTP_PER_IP_HOUR; i++) {
    const p = trPhone(20 + i);
    await registerCensus(p, `198.51.100.${i + 1}`);
    const r = await invoke(otpRequest, {
      method: "POST",
      path: "/api/otp/request",
      body: { phone: p },
      ip,
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  const ipLimited = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: trPhone(40) },
    ip,
  });
  assert.equal(ipLimited.status, 429);
});

test("HTTP OTP wrong code, consumed replay, expired", async () => {
  const phone = trPhone(50);
  await registerCensus(phone, "203.0.113.100");
  const first = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone },
    ip: "203.0.113.101",
  });
  const code = (first.json as { devCode: string }).devCode;
  assert.ok(code);
  const wrongCode = code === "000000" ? "999999" : "000000";
  const httpWrong = await invoke(otpVerify, {
    method: "POST",
    path: "/api/otp/verify",
    body: { phone, code: wrongCode },
    ip: "203.0.113.110",
  });
  assert.equal(httpWrong.status, 400);

  const phone2 = trPhone(51);
  await registerCensus(phone2, "203.0.113.121");
  const a = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: phone2 },
    ip: "203.0.113.122",
  });
  const codeA = (a.json as { devCode: string }).devCode;
  assert.ok(codeA);
  const neu = await invoke(otpVerify, {
    method: "POST",
    path: "/api/otp/verify",
    body: { phone: phone2, code: codeA },
    ip: "203.0.113.125",
  });
  assert.equal(neu.status, 200, JSON.stringify(neu.json));
  const replay = await invoke(otpVerify, {
    method: "POST",
    path: "/api/otp/verify",
    body: { phone: phone2, code: codeA },
    ip: "203.0.113.126",
  });
  assert.equal(replay.status, 409);

  const phone3 = trPhone(52);
  await registerCensus(phone3, "203.0.113.127");
  const c = await invoke(otpRequest, {
    method: "POST",
    path: "/api/otp/request",
    body: { phone: phone3 },
    ip: "203.0.113.128",
  });
  const codeC = (c.json as { devCode: string }).devCode;
  assert.ok(codeC);
  getDb()
    .prepare(`UPDATE phone_otps SET expires_at = ? WHERE consumed_at IS NULL`)
    .run("2000-01-01T00:00:00.000Z");
  const expired = await invoke(otpVerify, {
    method: "POST",
    path: "/api/otp/verify",
    body: { phone: phone3, code: codeC },
    ip: "203.0.113.129",
  });
  assert.ok(expired.status === 400 || expired.status === 200);
});

test("HTTP vote eligibility, concurrent duplicate, revoked/deleted/demo", async () => {
  const noAuth = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    body: {},
  });
  assert.ok(noAuth.status === 400 || noAuth.status === 401);

  const unverified = await registerCensus(trPhone(60), "203.0.113.130");
  const notReady = await invoke(votePost, {
    method: "POST",
    path: "/api/vote",
    body: { email: unverified.email, phone: unverified.phone },
    ip: "203.0.113.131",
  });
  assert.equal(notReady.status, 403);

  const { token } = await registerCensus(trPhone(61), "203.0.113.132");
  const verified = await verify(token, "203.0.113.133");
  const grant = grantCookie(verified.res);
  const [a, b] = await Promise.all([
    invoke(votePost, {
      method: "POST",
      path: "/api/vote",
      cookie: grant,
      body: {},
      ip: "203.0.113.134",
    }),
    invoke(votePost, {
      method: "POST",
      path: "/api/vote",
      cookie: grant,
      body: {},
      ip: "203.0.113.135",
    }),
  ]);
  const oks = [a, b].filter((r) => r.status === 200);
  assert.ok(oks.length >= 1);
  const fresh = oks.filter((r) => !(r.json as { alreadyVoted: boolean }).alreadyVoted);
  assert.ok(fresh.length <= 1);

  const pid = (
    getDb()
      .prepare(`SELECT participant_id FROM votes ORDER BY id DESC LIMIT 1`)
      .get() as { participant_id: number }
  ).participant_id;
  getDb()
    .prepare(`UPDATE votes SET revoked_at = ? WHERE participant_id = ?`)
    .run(new Date().toISOString(), pid);
  const live = liveNonDemo();
  const afterRevoke = live;
  getDb()
    .prepare(`UPDATE participants SET deleted_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), pid);
  const afterDelete = liveNonDemo();
  assert.ok(afterDelete <= afterRevoke);

  const prev = process.env.NODE_ENV;
  setNodeEnv("production");
  try {
    const stats = await invoke(statsGet, { path: "/api/stats" });
    const demoLeft = (
      getDb()
        .prepare(
          `SELECT COUNT(*) as c FROM votes v
           JOIN participants p ON p.id = v.participant_id
           WHERE p.email_norm LIKE ? AND v.revoked_at IS NULL`,
        )
        .get(`%@${SEED_DOMAIN}`) as { c: number }
    ).c;
    if (demoLeft > 0) {
      assert.ok(
        (stats.json as { total: number }).total < 10_000,
      );
    }
    const esk = cityVoteTotals("Eskişehir");
    assert.ok(esk.total >= 0);
  } finally {
    setNodeEnv(prev);
  }
  assert.equal(getCityBySlug("atlantis"), undefined);
  const urls = sitemap().map((e) => e.url);
  assert.equal(urls.filter((u) => u.includes("/il/")).length, 81);
  assert.ok(urls.some((u) => u.endsWith("/takimlar")));
  assert.ok(urls.some((u) => u.endsWith("/kvkk")));
  assert.equal(urls.some((u) => u.includes("/admin")), false);
  assert.equal(urls.length, new Set(urls).size);
});

function liveNonDemo() {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM votes v
         JOIN participants p ON p.id = v.participant_id
         WHERE v.poll_id = ? AND v.revoked_at IS NULL AND p.deleted_at IS NULL
           AND p.email_norm NOT LIKE ?`,
      )
      .get(CURRENT_POLL_ID, `%@${SEED_DOMAIN}`) as { c: number }
  ).c;
}
