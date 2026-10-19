import "./env-init";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "@/lib/db";
import {
  ADMIN_2FA_COOKIE,
  SESSION_COOKIE,
  SIGNUP_TICKET_COOKIE,
} from "../../lib/policy";
import { runWithTestHeaders } from "../../lib/request";
import { hashPassword } from "../../lib/password";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as otpRequest } from "../../app/api/auth/otp/request/route";
import { POST as otpVerify } from "../../app/api/auth/otp/verify/route";
import { POST as signup } from "../../app/api/auth/signup/route";

export const TEST_PASSWORD = "Passw0rd!";
export const ORIGIN = "http://localhost:3000";

let seq = 0;
export function uniq(prefix = "u") {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bt-http-"));
  process.env.BIZIM_TRIBUN_DB = path.join(dir, "t.db");
  resetDbForTests();
  return getDb();
}

export function setNodeEnv(value: string | undefined) {
  const env = process.env as { NODE_ENV?: string };
  if (value == null) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

export async function invoke(
  handler: (req: Request, ctx: never) => unknown,
  opts: {
    method?: string;
    path: string;
    body?: unknown;
    cookie?: string;
    ip?: string;
    params?: Record<string, string>;
  },
) {
  const headers = new Headers({
    host: "localhost:3000",
    origin: ORIGIN,
    "content-type": "application/json",
    "x-forwarded-for": opts.ip || "203.0.113.10",
  });
  if (opts.cookie) headers.set("cookie", opts.cookie);
  const init: RequestInit = { method: opts.method || "GET", headers };
  if (opts.body !== undefined && opts.method && opts.method !== "GET") {
    init.body = JSON.stringify(opts.body);
  }
  const req = new Request(`${ORIGIN}${opts.path}`, init);
  const ctx = opts.params
    ? { params: Promise.resolve(opts.params) }
    : undefined;
  const res = (await runWithTestHeaders(headers, () =>
    Promise.resolve(handler(req, ctx as never) as Promise<Response> | Response),
  )) as Response;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers, text, res };
}

export function setCookies(res: Response) {
  const list =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  return list as string[];
}

export function cookieValue(setCookieLines: string[], name: string) {
  for (const line of setCookieLines) {
    const part = line.split(";")[0] || "";
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

export function sessionCookie(res: Response) {
  const token = cookieValue(setCookies(res), SESSION_COOKIE);
  return token ? `${SESSION_COOKIE}=${token}` : "";
}

export function signupCookie(res: Response) {
  const token = cookieValue(setCookies(res), SIGNUP_TICKET_COOKIE);
  return token ? `${SIGNUP_TICKET_COOKIE}=${token}` : "";
}

export function admin2faCookie(res: Response) {
  const token = cookieValue(setCookies(res), ADMIN_2FA_COOKIE);
  return token ? `${ADMIN_2FA_COOKIE}=${token}` : "";
}

export function cookieFlags(setCookieLines: string[], name: string) {
  const line = setCookieLines.find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return {
    httpOnly: /;\s*HttpOnly/i.test(line),
    secure: /;\s*Secure/i.test(line),
    sameSite: /;\s*SameSite=([^;]+)/i.exec(line)?.[1] ?? null,
  };
}

const PII = [
  "email",
  "phone",
  "birth_date",
  "birthDate",
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "password_hash",
  "passwordHash",
  "session",
  "token_hash",
  "code_hash",
  "otpauthUrl",
  "matchedRules",
  "ruleId",
];

export function assertNoSensitiveLeak(payload: unknown, extra: string[] = []) {
  const raw = JSON.stringify(payload);
  for (const key of [...PII, ...extra]) {
    if (raw.includes(`"${key}"`)) {
      throw new Error(`sensitive key leaked: ${key}`);
    }
  }
}

export function authRegisterBody(over: {
  username: string;
  email: string;
  phone: string;
}) {
  return {
    username: over.username,
    firstName: "Ayşe",
    lastName: "Demir",
    birthDate: "1994-03-12",
    phone: over.phone,
    email: over.email,
    city: "İstanbul",
    teamId: "galatasaray",
    password: TEST_PASSWORD,
  };
}

/**
 * An account made by the old password sign-up (closed now): password,
 * e-mail, unverified phone, no vote. Signs in with the password route and
 * returns that response, so tests see a real session cookie.
 */
export async function legacyPasswordUser(opts: {
  body: ReturnType<typeof authRegisterBody>;
  ip?: string;
}) {
  const b = opts.body;
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO users
       (username, username_norm, display_name, email, email_norm, password_hash,
        team_id, status, role, created_at, updated_at,
        first_name, last_name, birth_date, phone, phone_norm, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'user', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      b.username,
      b.username.toLowerCase(),
      `${b.firstName} ${b.lastName}`,
      b.email,
      b.email.toLowerCase(),
      await hashPassword(b.password),
      b.teamId,
      now,
      now,
      b.firstName,
      b.lastName,
      b.birthDate,
      `+90${b.phone}`,
      b.phone,
      b.city,
    );
  const id = Number(info.lastInsertRowid);
  const res = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: b.username, password: b.password },
    ip: opts.ip,
  });
  if (res.status !== 200) throw new Error(`legacy login ${res.status}`);
  return {
    status: res.status,
    res: res.res,
    json: { user: { id, role: "user" } },
    cookie: sessionCookie(res.res),
  };
}

/** Full SMS sign-up: request code → verify → username + permanent team. */
export async function smsSignup(opts: {
  phone: string;
  username: string;
  teamId?: string;
  city?: string | null;
  ip?: string;
}) {
  const ip = opts.ip ?? "203.0.113.200";
  const sent = await invoke(otpRequest, {
    method: "POST",
    path: "/api/auth/otp/request",
    body: { phone: opts.phone },
    ip,
  });
  if (sent.status !== 200) throw new Error(`otp request ${sent.status} ${sent.text}`);
  const code = (sent.json as { devCode: string }).devCode;
  const verified = await invoke(otpVerify, {
    method: "POST",
    path: "/api/auth/otp/verify",
    body: { phone: opts.phone, code },
    ip,
  });
  if (verified.status !== 200) throw new Error(`otp verify ${verified.status} ${verified.text}`);
  const done = await invoke(signup, {
    method: "POST",
    path: "/api/auth/signup",
    cookie: signupCookie(verified.res),
    ip,
    body: {
      username: opts.username,
      teamId: opts.teamId ?? "galatasaray",
      city: opts.city === undefined ? "İstanbul" : opts.city,
      confirmTeamLocked: true,
      acceptTerms: true,
    },
  });
  if (done.status !== 200) throw new Error(`signup ${done.status} ${done.text}`);
  const user = (done.json as { user: { id: number; username: string } }).user;
  return { id: user.id, username: user.username, cookie: sessionCookie(done.res), res: done.res };
}

export function markPhoneVerified(userId: number) {
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE users SET phone_verified_at = ?, updated_at = ? WHERE id = ?`)
    .run(now, now, userId);
}

export function markEmailVerified(userId: number) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`,
    )
    .run(now, now, userId);
}

export function trPhone(n: number) {
  return `532${String(1000000 + n).slice(-7)}`;
}
