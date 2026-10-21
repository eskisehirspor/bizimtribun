import "./env-init";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GET as channelGet, POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";
import { GET as statsGet } from "../../app/api/stats/route";
import { POST as accountDelete } from "../../app/api/account/delete/route";
import { getDb } from "@/lib/db";
import { DEVICE_COOKIE, DEVICE_SIGNUP_MAX } from "@/lib/policy";
import { DEVICE_COOKIE_ERROR, DEVICE_LIMIT_ERROR } from "@/lib/device-limit";
import { DISPOSABLE_EMAIL_ERROR } from "@/lib/otp-http";
import {
  cookieFlags,
  cookies,
  deviceCookie,
  freshDb,
  invoke,
  LEGAL_OK,
  setCookies,
  signupCookie,
  testDevice,
  trPhone,
  uniq,
} from "./harness";
import { GET as marketingGet, POST as marketingPost } from "../../app/api/account/marketing/route";

beforeEach(() => {
  freshDb();
  process.env.VERIFY_CHANNEL = "email";
});
afterEach(() => {
  process.env.VERIFY_CHANNEL = "sms";
});

const name = () => uniq("ep").slice(0, 20);
let phoneSeq = 8000;
const nextPhone = () => trPhone(phoneSeq++);
let ipSeq = 0;
/** Each sign-up from its own IP, so only the device limit is under test. */
const ip = () => `198.51.100.${(ipSeq++ % 250) + 1}`;

async function sendCode(email: string, device?: string, from = ip()) {
  return invoke(otpRequest, {
    method: "POST",
    path: "/api/auth/otp/request",
    body: { email },
    cookie: device,
    ip: from,
  });
}

async function checkCode(email: string, code: string, device?: string, from = ip()) {
  return invoke(otpVerify, {
    method: "POST",
    path: "/api/auth/otp/verify",
    body: { email, code },
    cookie: device,
    ip: from,
  });
}

async function emailSignup(email: string, device: string, teamId = "galatasaray") {
  const sent = await sendCode(email, device);
  assert.equal(sent.status, 200, sent.text);
  const verified = await checkCode(email, (sent.json as { devCode: string }).devCode, device);
  if (verified.status !== 200) return verified;
  return invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: cookies(signupCookie(verified.res), device),
    ip: ip(),
    body: { username: name(), teamId, city: null, confirmTeamLocked: true, ...LEGAL_OK, phone: nextPhone() },
  });
}

/** Moves past the resend cooldown. */
function ageOtps() {
  getDb()
    .prepare(`UPDATE auth_otps SET created_at = ?`)
    .run(new Date(Date.now() - 2 * 60 * 1000).toISOString());
}

async function total() {
  return ((await invoke(statsGet, { path: "/api/stats" })).json as { total: number }).total;
}

test("the form asks for the channel the server uses", async () => {
  assert.equal(((await invoke(channelGet, { path: "/api/auth/otp/request" })).json as { channel: string }).channel, "email");
  process.env.VERIFY_CHANNEL = "sms";
  assert.equal(((await invoke(channelGet, { path: "/api/auth/otp/request" })).json as { channel: string }).channel, "sms");
});

test("e-mail sign-up: code → account verified by e-mail with its permanent vote", async () => {
  const email = `${uniq("fan")}@example.com`;
  const sent = await sendCode(email);
  assert.equal(sent.status, 200, sent.text);
  const flags = cookieFlags(setCookies(sent.res), DEVICE_COOKIE);
  assert.deepEqual(flags && { httpOnly: flags.httpOnly, sameSite: flags.sameSite }, { httpOnly: true, sameSite: "lax" });
  const device = deviceCookie(sent.res);

  const verified = await checkCode(email, (sent.json as { devCode: string }).devCode, device);
  assert.equal((verified.json as { next: string }).next, "signup");
  const done = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: cookies(signupCookie(verified.res), device),
    body: { username: name(), teamId: "eskisehirspor", city: "Eskişehir", confirmTeamLocked: true, ...LEGAL_OK, phone: nextPhone() },
  });
  assert.equal(done.status, 200, done.text);
  const user = (done.json as { user: { id: number; verified: boolean; phoneVerified: boolean } }).user;
  assert.equal(user.verified, true);
  assert.equal(user.phoneVerified, false);
  assert.equal(await total(), 1);
  const row = getDb().prepare(`SELECT email, email_norm, email_verified_at, phone_norm FROM users WHERE id = ?`).get(user.id) as {
    email: string;
    email_norm: string;
    email_verified_at: string | null;
    phone_norm: string | null;
  };
  assert.equal(row.email, email);
  assert.ok(row.email_verified_at);
  assert.ok(row.phone_norm); // typed on the form, not verified
  // The device row carries no account link.
  const dev = getDb().prepare(`SELECT * FROM device_signups`).all() as Record<string, unknown>[];
  assert.equal(dev.length, 1);
  assert.deepEqual(Object.keys(dev[0]).sort(), ["created_at", "device_hash", "id"]);

  // The same address signs in again, also written another way.
  ageOtps();
  const again = await sendCode(email.toUpperCase(), device);
  const login = await checkCode(email.toUpperCase(), (again.json as { devCode: string }).devCode, device);
  assert.equal((login.json as { next: string }).next, "home");
  assert.equal((login.json as { user: { id: number } }).user.id, user.id);
});

test("gmail dots and +tags are one inbox: no second account, no second vote", async () => {
  const device = testDevice();
  const first = await emailSignup("ali.veli@gmail.com", device);
  assert.equal(first.status, 200, first.text);
  ageOtps();
  const sent = await sendCode("aliveli+ikinci@googlemail.com", testDevice());
  const again = await checkCode("aliveli+ikinci@googlemail.com", (sent.json as { devCode: string }).devCode, testDevice());
  assert.equal((again.json as { next: string }).next, "home");
  assert.equal(await total(), 1);
});

test("throwaway inboxes and phone numbers are refused in e-mail mode", async () => {
  for (const email of ["x@mailinator.com", "x@sub.yopmail.com", "x@10minutemail.com"]) {
    const res = await sendCode(email);
    assert.equal(res.status, 400, email);
    assert.equal((res.json as { error: string }).error, DISPOSABLE_EMAIL_ERROR);
  }
  const phone = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { phone: "5321234567" } });
  assert.equal(phone.status, 400);
  assert.equal((getDb().prepare(`SELECT COUNT(*) as c FROM auth_otps`).get() as { c: number }).c, 0);
});

test(`one device opens at most ${DEVICE_SIGNUP_MAX} accounts, whatever the e-mail`, async () => {
  const device = testDevice();
  for (let i = 0; i < DEVICE_SIGNUP_MAX; i++) {
    const ok = await emailSignup(`${uniq("cihaz")}@example.com`, device);
    assert.equal(ok.status, 200, ok.text);
  }
  const blocked = await emailSignup(`${uniq("cihaz")}@example.com`, device);
  assert.equal(blocked.status, 429);
  assert.equal((blocked.json as { error: string }).error, DEVICE_LIMIT_ERROR);

  // A ticket taken before the limit was hit is still checked when the account is created.
  const other = testDevice();
  const email = `${uniq("cihaz")}@example.com`;
  const sent = await sendCode(email, other);
  const verified = await checkCode(email, (sent.json as { devCode: string }).devCode, other);
  const late = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: cookies(signupCookie(verified.res), device),
    ip: ip(),
    body: { username: name(), teamId: "galatasaray", city: null, confirmTeamLocked: true, ...LEGAL_OK, phone: nextPhone() },
  });
  assert.equal(late.status, 429);
  assert.equal(await total(), DEVICE_SIGNUP_MAX);

  // Another browser is a new device.
  const fresh = await emailSignup(`${uniq("cihaz")}@example.com`, testDevice());
  assert.equal(fresh.status, 200, fresh.text);
});

test("sign-up without the device cookie is refused", async () => {
  const email = `${uniq("cerez")}@example.com`;
  const sent = await sendCode(email);
  const verified = await checkCode(email, (sent.json as { devCode: string }).devCode);
  assert.equal(verified.status, 400);
  assert.equal((verified.json as { error: string }).error, DEVICE_COOKIE_ERROR);
});

test("a deleted e-mail account's address waits before it can sign up again", async () => {
  const email = `${uniq("sil")}@example.com`;
  const device = testDevice();
  const done = await emailSignup(email, device);
  assert.equal(done.status, 200, done.text);
  const cookie = setCookies(done.res).map((l) => l.split(";")[0]).join("; ");
  const del = await invoke(accountDelete, {
    method: "POST",
    path: "/api/account/delete",
    cookie,
    body: { confirm: "HESABIMI SİL" },
  });
  assert.equal(del.status, 200, del.text);
  assert.equal(await total(), 0);

  ageOtps();
  const sent = await sendCode(email, testDevice());
  const again = await checkCode(email, (sent.json as { devCode: string }).devCode, testDevice());
  assert.equal(again.status, 409);
});

async function ticketFor(email: string, device: string) {
  const sent = await sendCode(email, device);
  const verified = await checkCode(email, (sent.json as { devCode: string }).devCode, device);
  assert.equal(verified.status, 200, verified.text);
  return cookies(signupCookie(verified.res), device);
}

function signupWith(cookie: string, over: Record<string, unknown>) {
  return invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie,
    ip: ip(),
    body: { username: name(), teamId: "galatasaray", city: null, confirmTeamLocked: true, ...LEGAL_OK, phone: nextPhone(), ...over },
  });
}

test("sign-up asks for real name, phone and birth date; they stay private", async () => {
  const device = testDevice();
  const cookie = await ticketFor(`${uniq("bilgi")}@example.com`, device);
  for (const [over, status] of [
    [{ phone: null }, 400],
    [{ phone: "123" }, 400],
    [{ firstName: "" }, 400],
    [{ lastName: "1" }, 400],
    [{ birthDate: "2099-01-01" }, 400],
    [{ birthDate: "1990-02-30" }, 400],
    [{ birthDate: new Date(Date.now() - 10 * 365 * 86400000).toISOString().slice(0, 10) }, 400],
  ] as const) {
    const res = await signupWith(cookie, over);
    assert.equal(res.status, status, JSON.stringify(over));
  }
  const phone = nextPhone();
  const ok = await signupWith(cookie, { firstName: " Çağrı ", lastName: "Öztürk-Şahin", phone });
  assert.equal(ok.status, 200, ok.text);
  assert.ok(!/Çağrı|Öztürk|1994-03-12/.test(ok.text));
  const id = (ok.json as { user: { id: number } }).user.id;
  const row = getDb()
    .prepare(`SELECT first_name, last_name, birth_date, phone_norm, phone_verified_at, marketing_consent_at FROM users WHERE id = ?`)
    .get(id) as Record<string, string | null>;
  assert.deepEqual(row, {
    first_name: "Çağrı",
    last_name: "Öztürk-Şahin",
    birth_date: "1994-03-12",
    phone_norm: phone,
    phone_verified_at: null,
    marketing_consent_at: null,
  });

  // The same phone cannot be typed on a second account.
  const other = await ticketFor(`${uniq("bilgi")}@example.com`, testDevice());
  const dup = await signupWith(other, { phone });
  assert.equal(dup.status, 409);
});

test("campaign SMS consent is optional, separate and can be withdrawn", async () => {
  const cookie = await ticketFor(`${uniq("izin")}@example.com`, testDevice());
  const ok = await signupWith(cookie, { marketingConsent: true });
  assert.equal(ok.status, 200, ok.text);
  const session = setCookies(ok.res).map((l) => l.split(";")[0]).join("; ");
  const id = (ok.json as { user: { id: number } }).user.id;
  const at = () =>
    (getDb().prepare(`SELECT marketing_consent_at as m FROM users WHERE id = ?`).get(id) as { m: string | null }).m;
  assert.ok(at());
  assert.equal(((await invoke(marketingGet, { path: "/api/account/marketing", cookie: session })).json as { consent: boolean }).consent, true);
  const off = await invoke(marketingPost, { method: "POST", path: "/api/account/marketing", cookie: session, body: { consent: false } });
  assert.equal(off.status, 200, off.text);
  assert.equal(at(), null);
});
