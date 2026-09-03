import "./env-init";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, resetDbForTests } from "@/lib/db";
import {
  ADMIN_2FA_COOKIE,
  SESSION_COOKIE,
  VOTE_GRANT_COOKIE,
} from "../../lib/policy";
import { runWithTestHeaders } from "../../lib/request";

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

export function setPhoneVerification(on: boolean) {
  process.env.PHONE_VERIFICATION_ENABLED = on ? "true" : "false";
}

export async function invoke(
  handler: (req: Request, ctx?: any) => any,
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
    Promise.resolve(handler(req, ctx) as Promise<Response> | Response),
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

export function grantCookie(res: Response) {
  const token = cookieValue(setCookies(res), VOTE_GRANT_COOKIE);
  return token ? `${VOTE_GRANT_COOKIE}=${token}` : "";
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

export function censusBody(over: {
  email: string;
  phone: string;
  fingerprint?: string;
}) {
  return {
    firstName: "Ahmet",
    lastName: "Yılmaz",
    phone: over.phone,
    email: over.email,
    teamId: "galatasaray",
    city: "İstanbul",
    fingerprint: over.fingerprint || randomBytes(16).toString("hex"),
    kvkk: true as const,
    riza: true as const,
  };
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
