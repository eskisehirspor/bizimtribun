import { getDb } from "./db";
import { hmac, newToken } from "./crypto";
import { writeAudit } from "./audit";
import { sendPasswordResetEmail } from "./mail";
import { hashPassword, isStrongPassword } from "./password";
import { hashedIp, registerAttemptCount } from "./stats";
import { findUserByEmailNorm, isUserBanned } from "./users";
import {
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_PER_IP_HOUR,
  PASSWORD_RESET_PER_USER_HOUR,
  PASSWORD_RESET_TTL_MS,
} from "./policy";

export const PASSWORD_RESET_SENT =
  "Şifre belirleme linki e-postana gönderildi. Gelmediyse spam klasörüne bak.";
// The sign-up page already says which addresses are members, so this does too.
export const PASSWORD_RESET_UNKNOWN = "Bu e-postayla kayıtlı bir hesap yok. Adresi kontrol et ya da üye ol.";
export const PASSWORD_RESET_LIMITED = "Çok fazla istek geldi. Biraz sonra tekrar dene.";

function tokenHash(raw: string) {
  return hmac(`password-reset:${raw}`);
}

const ipKey = (ip: string) => hashedIp(`password-reset-ip:${ip}`);
const userKey = (userId: number) => hmac(`password-reset-user:${userId}`);

async function noteAttempt(key: string, now: string) {
  await getDb().prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`).run(key, now);
}

/**
 * "Forgot my password": mails a one-time link (30 minutes) to the account on
 * this address, or says there is no such account. Repeats inside the
 * cooldown and per-account limit answer "sent" without a new mail.
 */
export async function requestPasswordReset(emailNorm: string, ip: string, now = Date.now()) {
  if ((await registerAttemptCount(ipKey(ip))) >= PASSWORD_RESET_PER_IP_HOUR) {
    return { ok: false as const, status: 429, error: PASSWORD_RESET_LIMITED };
  }
  const nowIso = new Date(now).toISOString();
  await noteAttempt(ipKey(ip), nowIso);

  const user = await findUserByEmailNorm(emailNorm);
  if (!user || user.deleted_at || !user.email) {
    return { ok: false as const, status: 404, error: PASSWORD_RESET_UNKNOWN };
  }
  if (isUserBanned(user)) return { ok: false as const, status: 403, error: "Hesap askıya alınmış." };

  const db = getDb();
  if ((await registerAttemptCount(userKey(user.id))) >= PASSWORD_RESET_PER_USER_HOUR) return { ok: true as const };
  const last = (await db
    .prepare(`SELECT created_at FROM password_resets WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
    .get(user.id)) as { created_at: string } | undefined;
  if (last && now - Date.parse(last.created_at) < PASSWORD_RESET_COOLDOWN_MS) return { ok: true as const };

  const raw = newToken();
  // Only the newest link works.
  await db.prepare(`DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL`).run(user.id);
  await db
    .prepare(`INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run(user.id, tokenHash(raw), new Date(now + PASSWORD_RESET_TTL_MS).toISOString(), nowIso);
  await noteAttempt(userKey(user.id), nowIso);
  await sendPasswordResetEmail(user.email, raw);
  return { ok: true as const };
}

/**
 * Sets the new password from a reset link and signs the account out
 * everywhere. Opening the link also proves the address, so an unverified
 * e-mail becomes verified.
 */
export async function consumePasswordReset(rawToken: string, password: string, now = Date.now()) {
  if (!isStrongPassword(password)) return { ok: false as const, status: 400, error: "weak" as const };
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT r.id, r.user_id, r.expires_at, r.used_at, u.status, u.banned_at, u.ban_expires_at, u.deleted_at
       FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ?`,
    )
    .get(tokenHash(rawToken))) as
    | {
        id: number;
        user_id: number;
        expires_at: string;
        used_at: string | null;
        status: string;
        banned_at: string | null;
        ban_expires_at: string | null;
        deleted_at: string | null;
      }
    | undefined;
  if (!row || row.deleted_at) return { ok: false as const, status: 400, error: "Link geçersiz." };
  if (row.used_at) return { ok: false as const, status: 400, error: "Bu link zaten kullanılmış." };
  if (Date.parse(row.expires_at) < now) {
    return { ok: false as const, status: 400, error: "Linkin süresi dolmuş. Yeniden şifremi unuttum de." };
  }
  if (isUserBanned(row)) return { ok: false as const, status: 403, error: "Hesap askıya alınmış." };

  const hash = await hashPassword(password);
  const nowIso = new Date(now).toISOString();
  try {
    await db.transaction(async () => {
      const hit = await db
        .prepare(`UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL`)
        .run(nowIso, row.id);
      if (hit.changes !== 1) throw new Error("RESET_USED");
      await db
        .prepare(
          `UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ?
           WHERE id = ?`,
        )
        .run(hash, nowIso, nowIso, row.user_id);
      await db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .run(nowIso, row.user_id);
    })();
  } catch {
    return { ok: false as const, status: 400, error: "Bu link zaten kullanılmış." };
  }
  await writeAudit(db, { actorUserId: row.user_id, action: "password_reset", targetType: "user", targetId: row.user_id });
  return { ok: true as const };
}
