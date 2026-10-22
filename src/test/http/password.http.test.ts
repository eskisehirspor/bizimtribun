import "./env-init";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as pwGet, POST as pwPost } from "../../app/api/account/password/route";
import { getDb } from "@/lib/db";
import {
  cookies,
  freshDb,
  invoke,
  LEGAL_OK,
  sessionCookie,
  signupCookie,
  testDevice,
  TEST_PASSWORD,
  trPhone,
  uniq,
} from "./harness";

beforeEach(async () => {
  await freshDb();
  process.env.VERIFY_CHANNEL = "email";
});
afterEach(() => {
  process.env.VERIFY_CHANNEL = "sms";
});

let seq = 0;
const ip = () => `198.51.100.${(seq++ % 250) + 1}`;

async function ticket(email: string, device: string) {
  const sent = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { email }, cookie: device, ip: ip() });
  assert.equal(sent.status, 200, sent.text);
  const ok = await invoke(otpVerify, {
    method: "POST",
    path: "/api/auth/otp/verify",
    body: { email, code: (sent.json as { devCode: string }).devCode },
    cookie: device,
    ip: ip(),
  });
  assert.equal(ok.status, 200, ok.text);
  return cookies(signupCookie(ok.res), device);
}

function signupBody(over: Record<string, unknown> = {}) {
  return {
    username: uniq("pw").slice(0, 20),
    teamId: "galatasaray",
    city: "Eskişehir",
    confirmTeamLocked: true,
    ...LEGAL_OK,
    phone: trPhone(9000 + seq++),
    ...over,
  };
}

test("sign-up needs a strong password; e-mail + password signs in afterwards", async () => {
  const email = `${uniq("sifre")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  for (const password of ["", "kisa1!", "hepsikucuk1!", "HEPSIBUYUK1!", "Rakamsiz!!", "Ozelsiz123"]) {
    const res = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody({ password }) });
    assert.equal(res.status, 400, password);
  }
  const ok = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() });
  assert.equal(ok.status, 200, ok.text);
  const row = (await getDb().prepare(`SELECT password_hash FROM users WHERE email_norm = ?`).get(email)) as { password_hash: string };
  assert.match(row.password_hash, /^scrypt\$/);

  const bad = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: "Yanlis123!" }, ip: ip() });
  assert.equal(bad.status, 401);
  const good = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: TEST_PASSWORD }, ip: ip() });
  assert.equal(good.status, 200, good.text);
});

test("the sign-up page tells an existing address to sign in instead of sending a code", async () => {
  const email = `${uniq("var")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  assert.equal((await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() })).status, 200);

  const again = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request?amac=kayit", body: { email }, cookie: device, ip: ip() });
  assert.equal(again.status, 409);
  assert.match((again.json as { error: string }).error, /zaten üyesin/);
  const fresh = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request?amac=kayit", body: { email: `${uniq("yeni")}@example.com` }, cookie: device, ip: ip() });
  assert.equal(fresh.status, 200);
  // Sign-in itself still answers the same for everyone.
  const signIn = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { email }, cookie: device, ip: ip() });
  // Sign-in answers the same for every address (no 409), whatever the cooldown says.
  assert.notEqual(signIn.status, 409);
});

test("changing the password needs the old one unless the sign-in is fresh", async () => {
  const email = `${uniq("deg")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  const made = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() });
  const session = sessionCookie(made.res);
  const status = await invoke(pwGet, { path: "/api/account/password", cookie: session });
  assert.equal((status.json as { hasPassword: boolean }).hasPassword, true);

  // A fresh session (just signed in) may set a new one without the old password.
  const weak = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "zayif" } });
  assert.equal(weak.status, 400);
  const fresh = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "YeniSifre1!" } });
  assert.equal(fresh.status, 200, fresh.text);

  // An older session must give the current password.
  await getDb().prepare(`UPDATE sessions SET created_at = ?`).run(new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const noOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!" } });
  assert.equal(noOld.status, 403);
  const wrongOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!", currentPassword: TEST_PASSWORD } });
  assert.equal(wrongOld.status, 403);
  const withOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!", currentPassword: "YeniSifre1!" } });
  assert.equal(withOld.status, 200, withOld.text);
  const loginNew = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: "BaskaSifre2!" }, ip: ip() });
  assert.equal(loginNew.status, 200);
});

test("password page needs a signed-in member", async () => {
  const res = await invoke(pwPost, { method: "POST", path: "/api/account/password", body: { password: "YeniSifre1!" } });
  assert.equal(res.status, 401);
});
