import type Database from "better-sqlite3";
import { getDb } from "./db";
import { hmac, newToken } from "./crypto";
import { hashedIp, registerAttemptCount } from "./stats";
import { isUserBanned, type UserRow } from "./users";
import {
  USER_EMAIL_RESEND_COOLDOWN_MS,
  USER_EMAIL_RESEND_PER_IP_HOUR,
  USER_EMAIL_RESEND_PER_USER_HOUR,
  USER_EMAIL_VERIFY_TTL_MS,
} from "./policy";

export const USER_VERIFY_GENERIC_SENT =
  "Doğrulama bağlantısı e-posta adresine gönderildi.";
export const USER_VERIFY_ALREADY = "E-posta adresin zaten doğrulanmış.";

function tokenHash(raw: string) {
  return hmac(`user-email:${raw}`);
}

function userResendKey(userId: number) {
  return hmac(`user-email-resend:${userId}`);
}

export function issueUserEmailToken(userId: number, now = Date.now()) {
  const db = getDb();
  const raw = newToken();
  const nowIso = new Date(now).toISOString();
  const expires = new Date(now + USER_EMAIL_VERIFY_TTL_MS).toISOString();
  db.prepare(
    `DELETE FROM user_email_tokens WHERE user_id = ? AND used_at IS NULL`,
  ).run(userId);
  db.prepare(
    `INSERT INTO user_email_tokens (user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(userId, tokenHash(raw), expires, nowIso);
  return raw;
}

export function consumeUserEmailToken(rawToken: string, now = Date.now()) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.id as token_id, t.user_id, t.expires_at, t.used_at,
              u.status, u.banned_at, u.ban_expires_at, u.email_verified_at
       FROM user_email_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?`,
    )
    .get(tokenHash(rawToken)) as
    | {
        token_id: number;
        user_id: number;
        expires_at: string;
        used_at: string | null;
        status: string;
        banned_at: string | null;
        ban_expires_at: string | null;
        email_verified_at: string | null;
      }
    | undefined;

  if (!row) return { ok: false as const, error: "Link geçersiz." };
  if (row.used_at) {
    return { ok: false as const, error: "Bu link zaten kullanılmış." };
  }
  if (new Date(row.expires_at).getTime() < now) {
    return { ok: false as const, error: "Linkin süresi dolmuş. Yeni mail iste." };
  }
  if (
    isUserBanned({
      status: row.status,
      banned_at: row.banned_at,
      ban_expires_at: row.ban_expires_at,
    })
  ) {
    return { ok: false as const, error: "Hesap askıya alınmış." };
  }

  const nowIso = new Date(now).toISOString();
  try {
    db.transaction(() => {
      const tokenHit = db
        .prepare(
          `UPDATE user_email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`,
        )
        .run(nowIso, row.token_id);
      if (tokenHit.changes !== 1) throw new Error("VERIFY_FAILED");

      if (!row.email_verified_at) {
        const userHit = db
          .prepare(
            `UPDATE users
             SET email_verified_at = ?, updated_at = ?
             WHERE id = ? AND email_verified_at IS NULL`,
          )
          .run(nowIso, nowIso, row.user_id);
        if (userHit.changes !== 1) throw new Error("VERIFY_FAILED");
      }
    })();
  } catch {
    return { ok: false as const, error: "Bu kayıt doğrulanamadı." };
  }

  return { ok: true as const, userId: row.user_id };
}

function lastAttemptAt(db: Database.Database, key: string) {
  const row = db
    .prepare(
      `SELECT created_at FROM register_attempts
       WHERE ip_hash = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(key) as { created_at: string } | undefined;
  return row?.created_at;
}

export function userEmailResendLimited(ip: string, userId: number) {
  const ipHash = hashedIp(`user-email-resend-ip:${ip}`);
  const userHash = userResendKey(userId);
  if (registerAttemptCount(ipHash) >= USER_EMAIL_RESEND_PER_IP_HOUR) {
    return { limited: true as const, reason: "ip" as const };
  }
  if (registerAttemptCount(userHash) >= USER_EMAIL_RESEND_PER_USER_HOUR) {
    return { limited: true as const, reason: "user" as const };
  }
  const last = lastAttemptAt(getDb(), userHash);
  if (last && Date.now() - new Date(last).getTime() < USER_EMAIL_RESEND_COOLDOWN_MS) {
    return { limited: true as const, reason: "cooldown" as const };
  }
  return { limited: false as const };
}

export function noteUserEmailResend(ip: string, userId: number) {
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`,
  ).run(hashedIp(`user-email-resend-ip:${ip}`), now);
  db.prepare(
    `INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`,
  ).run(userResendKey(userId), now);
}

export function unusedUserEmailTokenCount(userId: number) {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM user_email_tokens
         WHERE user_id = ? AND used_at IS NULL`,
      )
      .get(userId) as { c: number }
  ).c;
}

export function userEmailTokensPlaintextLeak(userId: number, raw: string) {
  const rows = getDb()
    .prepare(`SELECT token_hash FROM user_email_tokens WHERE user_id = ?`)
    .all(userId) as { token_hash: string }[];
  return rows.some((r) => r.token_hash === raw);
}

export function isUserEmailVerified(user: Pick<UserRow, "email_verified_at">) {
  return Boolean(user.email_verified_at);
}
