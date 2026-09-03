import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { hmac, newToken } from "./crypto";
import {
  ADMIN_2FA_CHALLENGE_TTL_MS,
  ADMIN_2FA_COOKIE,
  SESSION_ADMIN_IDLE_MS,
  SESSION_ADMIN_TTL_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./policy";
import { applyDevAdminBootstrap } from "./admin-bootstrap";
import {
  findUserById,
  isAdmin,
  isUserBanned,
  reconcileExpiredBan,
  toPublicUser,
  type PublicUser,
  type UserRow,
} from "./users";
import { FORUM_EMAIL_UNVERIFIED_ERROR } from "./policy";

type SessionRow = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
};

function tokenHash(raw: string) {
  return hmac(`session:${raw}`);
}

export function sessionTtlMsForUser(user: Pick<UserRow, "role"> | undefined) {
  return user && isAdmin(user) ? SESSION_ADMIN_TTL_MS : SESSION_TTL_MS;
}

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function attachSessionCookie(
  res: NextResponse,
  rawToken: string,
  ttlMs = SESSION_TTL_MS,
) {
  res.cookies.set(
    SESSION_COOKIE,
    rawToken,
    sessionCookieOptions(Math.floor(ttlMs / 1000)),
  );
  return res;
}

export function attachAdmin2faCookie(res: NextResponse, rawToken: string) {
  res.cookies.set(
    ADMIN_2FA_COOKIE,
    rawToken,
    sessionCookieOptions(Math.floor(ADMIN_2FA_CHALLENGE_TTL_MS / 1000)),
  );
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

export function clearAdmin2faCookie(res: NextResponse) {
  res.cookies.set(ADMIN_2FA_COOKIE, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

export function createSession(userId: number) {
  const raw = newToken();
  const now = new Date();
  const user = findUserById(userId);
  const ttl = sessionTtlMsForUser(user);
  const expires = new Date(now.getTime() + ttl).toISOString();
  const nowIso = now.toISOString();
  getDb()
    .prepare(
      `INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(userId, tokenHash(raw), expires, nowIso, nowIso);
  getDb()
    .prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`)
    .run(nowIso, nowIso, userId);
  return raw;
}

export function revokeSessionByToken(raw: string | null | undefined) {
  if (!raw) return;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`,
    )
    .run(now, tokenHash(raw));
}

function cookieFromHeader(header: string | null, cookieName: string) {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === cookieName) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function readSessionToken(req?: Request) {
  if (req) return cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE);
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function readAdmin2faToken(req?: Request) {
  if (req) return cookieFromHeader(req.headers.get("cookie"), ADMIN_2FA_COOKIE);
  const jar = await cookies();
  return jar.get(ADMIN_2FA_COOKIE)?.value ?? null;
}

export function userFromSessionToken(raw: string | null | undefined) {
  if (!raw) return undefined;
  const row = getDb()
    .prepare(`SELECT * FROM sessions WHERE token_hash = ?`)
    .get(tokenHash(raw)) as SessionRow | undefined;
  if (!row || row.revoked_at) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) return undefined;
  const loaded = findUserById(row.user_id);
  if (!loaded) return undefined;
  const user = reconcileExpiredBan(loaded);
  if (isAdmin(user)) {
    const last = Date.parse(row.last_seen_at || row.created_at);
    if (Number.isFinite(last) && Date.now() - last > SESSION_ADMIN_IDLE_MS) {
      const now = new Date().toISOString();
      getDb()
        .prepare(
          `UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
        )
        .run(now, row.id);
      return undefined;
    }
    getDb()
      .prepare(
        `UPDATE sessions SET last_seen_at = ? WHERE id = ? AND revoked_at IS NULL`,
      )
      .run(new Date().toISOString(), row.id);
  }
  return user;
}

export async function getSessionUser(req?: Request) {
  applyDevAdminBootstrap();
  const token = await readSessionToken(req);
  return userFromSessionToken(token);
}

/** Active, non-banned account. Use before forum writes later. */
export function requireActiveUser(user: UserRow | undefined): {
  ok: true;
  user: UserRow;
  publicUser: PublicUser;
} | { ok: false; error: string; status: number } {
  if (!user) return { ok: false, error: "Giriş gerekli.", status: 401 };
  if (isUserBanned(user)) {
    return { ok: false, error: "Hesap askıya alınmış.", status: 403 };
  }
  return { ok: true, user, publicUser: toPublicUser(user) };
}

export function requireForumWriter(user: UserRow | undefined): {
  ok: true;
  user: UserRow;
  publicUser: PublicUser;
} | { ok: false; error: string; status: number } {
  const active = requireActiveUser(user);
  if (!active.ok) return active;
  if (!active.user.email_verified_at) {
    return {
      ok: false,
      error: FORUM_EMAIL_UNVERIFIED_ERROR,
      status: 403,
    };
  }
  return active;
}
