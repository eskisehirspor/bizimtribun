import "./env-init";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as pwGet, POST as pwPost } from "../../app/api/account/password/route";
import { POST as resetRequest } from "../../app/api/auth/password-reset/route";
import { POST as resetConfirm } from "../../app/api/auth/password-reset/confirm/route";
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

const RESET_FILE = path.join(process.cwd(), "data", "last-reset-link.txt");

beforeEach(async () => {
  await freshDb();
  fs.rmSync(RESET_FILE, { force: true });
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

test("a registered address gets no code: members sign in with their password", async () => {
  const email = `${uniq("var")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  assert.equal((await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() })).status, 200);

  const again = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { email }, cookie: device, ip: ip() });
  assert.equal(again.status, 409);
  assert.match((again.json as { error: string }).error, /zaten üyesin/);
  const fresh = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { email: `${uniq("yeni")}@example.com` }, cookie: device, ip: ip() });
  assert.equal(fresh.status, 200);
});

test("a code issued before sign-up finished does not sign in", async () => {
  const email = `${uniq("eski")}@example.com`;
  const device = testDevice();
  const early = await invoke(otpRequest, { method: "POST", path: "/api/auth/otp/request", body: { email }, cookie: device, ip: ip() });
  const cookie = await (async () => {
    await getDb().prepare(`UPDATE auth_otps SET created_at = ?`).run(new Date(Date.now() - 2 * 60 * 1000).toISOString());
    return ticket(email, device);
  })();
  assert.equal((await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() })).status, 200);
  const late = await invoke(otpVerify, {
    method: "POST",
    path: "/api/auth/otp/verify",
    body: { email, code: (early.json as { devCode: string }).devCode },
    cookie: device,
    ip: ip(),
  });
  assert.notEqual(late.status, 200);
  assert.equal(sessionCookie(late.res), "");
});

test("changing the password needs the old one", async () => {
  const email = `${uniq("deg")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  const made = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() });
  const session = sessionCookie(made.res);
  const status = await invoke(pwGet, { path: "/api/account/password", cookie: session });
  assert.equal((status.json as { hasPassword: boolean }).hasPassword, true);

  const weak = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "zayif", currentPassword: TEST_PASSWORD } });
  assert.equal(weak.status, 400);
  const noOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!" } });
  assert.equal(noOld.status, 403);
  const wrongOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!", currentPassword: "Yanlis123!" } });
  assert.equal(wrongOld.status, 403);
  const withOld = await invoke(pwPost, { method: "POST", path: "/api/account/password", cookie: session, body: { password: "BaskaSifre2!", currentPassword: TEST_PASSWORD } });
  assert.equal(withOld.status, 200, withOld.text);
  const loginNew = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: "BaskaSifre2!" }, ip: ip() });
  assert.equal(loginNew.status, 200);
});

test("forgot password: one-time link, same answer for unknown addresses, signs out everywhere", async () => {
  const email = `${uniq("unut")}@example.com`;
  const device = testDevice();
  const cookie = await ticket(email, device);
  const made = await invoke(signup, { method: "POST", path: "/api/auth/signup", cookie, ip: ip(), body: signupBody() });
  const session = sessionCookie(made.res);

  const unknown = await invoke(resetRequest, { method: "POST", path: "/api/auth/password-reset", body: { email: `${uniq("yok")}@example.com` }, ip: ip() });
  assert.equal(unknown.status, 200);
  assert.equal(fs.existsSync(RESET_FILE), false);

  const asked = await invoke(resetRequest, { method: "POST", path: "/api/auth/password-reset", body: { email: email.toUpperCase() }, ip: ip() });
  assert.equal(asked.status, 200);
  assert.equal((asked.json as { message: string }).message, (unknown.json as { message: string }).message);
  const token = /token=([a-f0-9]{64})/.exec(fs.readFileSync(RESET_FILE, "utf8"))![1];

  const weak = await invoke(resetConfirm, { method: "POST", path: "/api/auth/password-reset/confirm", body: { token, password: "zayif" } });
  assert.equal(weak.status, 400);
  const ok = await invoke(resetConfirm, { method: "POST", path: "/api/auth/password-reset/confirm", body: { token, password: "Unuttum9!" } });
  assert.equal(ok.status, 200, ok.text);
  const reused = await invoke(resetConfirm, { method: "POST", path: "/api/auth/password-reset/confirm", body: { token, password: "Unuttum9!x" } });
  assert.equal(reused.status, 400);

  const me = await invoke(pwGet, { path: "/api/account/password", cookie: session });
  assert.equal(me.status, 401);
  const oldPw = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: TEST_PASSWORD }, ip: ip() });
  assert.equal(oldPw.status, 401);
  const newPw = await invoke(login, { method: "POST", path: "/api/auth/login", body: { login: email, password: "Unuttum9!" }, ip: ip() });
  assert.equal(newPw.status, 200, newPw.text);
});

test("password page needs a signed-in member", async () => {
  const res = await invoke(pwPost, { method: "POST", path: "/api/account/password", body: { password: "YeniSifre1!" } });
  assert.equal(res.status, 401);
});
