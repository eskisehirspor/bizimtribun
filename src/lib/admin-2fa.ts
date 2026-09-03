import type Database from "better-sqlite3";
import { hmac, newToken } from "./crypto";
import { randomBytes } from "crypto";
import {
  ADMIN_2FA_CHALLENGE_TTL_MS,
  ADMIN_TOTP_SETUP_TTL_MS,
  AUTH_TOTP_PER_IP_HOUR,
  AUTH_TOTP_PER_USER_HOUR,
} from "./policy";
import { decryptSecret, encryptSecret } from "./secret-box";
import {
  generateTotpSecret,
  totpOtpAuthUrl,
  verifyTotpCode,
} from "./totp";

const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RECOVERY_COUNT = 10;

export function recoveryCodeHash(userId: number, code: string) {
  return hmac(`admin-recovery:${userId}:${normalizeRecoveryCode(code)}`);
}

export function normalizeRecoveryCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateRecoveryCode() {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += RECOVERY_ALPHABET[bytes[i]! % RECOVERY_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export function recoveryCodesAreHashed(stored: string) {
  return /^[a-f0-9]{64}$/.test(stored);
}

export function isAdminTotpEnabled(user: {
  role?: string;
  totp_enabled?: number | null;
}) {
  return user.role === "admin" && Number(user.totp_enabled) === 1;
}

export function passwordLoginNextStep(user: {
  role?: string;
  totp_enabled?: number | null;
}) {
  return isAdminTotpEnabled(user) ? "need2fa" : "session";
}

export function recordSecurityEvent(
  db: Database.Database,
  input: {
    userId?: number | null;
    action: string;
    success: boolean;
    ipHash?: string | null;
    uaHash?: string | null;
  },
) {
  db.prepare(
    `INSERT INTO security_events (user_id, action, success, ip_hash, ua_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.userId ?? null,
    input.action.slice(0, 64),
    input.success ? 1 : 0,
    input.ipHash ?? null,
    input.uaHash ?? null,
    new Date().toISOString(),
  );
}

function attemptCount(db: Database.Database, ipHash: string, sinceIso: string) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM register_attempts
         WHERE ip_hash = ? AND created_at >= ?`,
      )
      .get(ipHash, sinceIso) as { c: number }
  ).c;
}

export function totpVerifyLimited(
  db: Database.Database,
  ipHash: string,
  userId: number,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const userHash = hmac(`auth-totp-user:${userId}`);
  return (
    attemptCount(db, ipHash, since) >= AUTH_TOTP_PER_IP_HOUR ||
    attemptCount(db, userHash, since) >= AUTH_TOTP_PER_USER_HOUR
  );
}

export function noteTotpVerifyAttempt(
  db: Database.Database,
  ipHash: string,
  userId: number,
) {
  const now = new Date().toISOString();
  const userHash = hmac(`auth-totp-user:${userId}`);
  db.prepare(
    `INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`,
  ).run(ipHash, now);
  db.prepare(
    `INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`,
  ).run(userHash, now);
}

export function revokeUserSessionsOn(
  db: Database.Database,
  userId: number,
  exceptTokenHash?: string | null,
) {
  const now = new Date().toISOString();
  if (exceptTokenHash) {
    db.prepare(
      `UPDATE sessions
       SET revoked_at = ?
       WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`,
    ).run(now, userId, exceptTokenHash);
    return;
  }
  db.prepare(
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
  ).run(now, userId);
}

function replaceRecoveryCodes(db: Database.Database, userId: number) {
  db.prepare(`DELETE FROM admin_recovery_codes WHERE user_id = ?`).run(userId);
  const now = new Date().toISOString();
  const plain: string[] = [];
  const insert = db.prepare(
    `INSERT INTO admin_recovery_codes (user_id, code_hash, created_at)
     VALUES (?, ?, ?)`,
  );
  for (let i = 0; i < RECOVERY_COUNT; i++) {
    const code = generateRecoveryCode();
    plain.push(code);
    insert.run(userId, recoveryCodeHash(userId, code), now);
  }
  return plain;
}

export function remainingRecoveryCount(db: Database.Database, userId: number) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM admin_recovery_codes
         WHERE user_id = ? AND used_at IS NULL`,
      )
      .get(userId) as { c: number }
  ).c;
}

export function startTotpSetup(
  db: Database.Database,
  user: { id: number; username: string; role: string },
) {
  if (user.role !== "admin") {
    return { ok: false as const, error: "Bu işlem için yetkin yok.", status: 403 };
  }
  const secret = generateTotpSecret();
  const now = Date.now();
  db.prepare(
    `INSERT INTO admin_totp_setup (user_id, secret_enc, created_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       secret_enc = excluded.secret_enc,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at`,
  ).run(
    user.id,
    encryptSecret(secret),
    new Date(now).toISOString(),
    new Date(now + ADMIN_TOTP_SETUP_TTL_MS).toISOString(),
  );
  return {
    ok: true as const,
    secret,
    otpauthUrl: totpOtpAuthUrl({ secret, accountName: user.username }),
  };
}

export function totpEnabledOn(db: Database.Database, userId: number) {
  const row = db
    .prepare(`SELECT totp_enabled FROM users WHERE id = ?`)
    .get(userId) as { totp_enabled: number } | undefined;
  return Number(row?.totp_enabled) === 1;
}

export function confirmTotpSetup(
  db: Database.Database,
  userId: number,
  code: string,
  ctx: { ipHash?: string | null; uaHash?: string | null },
) {
  const pending = db
    .prepare(
      `SELECT secret_enc, expires_at FROM admin_totp_setup WHERE user_id = ?`,
    )
    .get(userId) as { secret_enc: string; expires_at: string } | undefined;
  if (ctx.ipHash && totpVerifyLimited(db, ctx.ipHash, userId)) {
    return { ok: false as const, error: "Çok fazla deneme. Biraz sonra dene.", status: 429 };
  }
  if (ctx.ipHash) noteTotpVerifyAttempt(db, ctx.ipHash, userId);
  if (!pending || new Date(pending.expires_at).getTime() < Date.now()) {
    recordSecurityEvent(db, {
      userId,
      action: "totp_setup_verify",
      success: false,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
    return { ok: false as const, error: "Kurulum süresi doldu. Yeniden başlat.", status: 400 };
  }
  const secret = decryptSecret(pending.secret_enc);
  if (!secret || !verifyTotpCode(secret, code)) {
    recordSecurityEvent(db, {
      userId,
      action: "totp_setup_verify",
      success: false,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
    return { ok: false as const, error: "Doğrulama kodu hatalı.", status: 401 };
  }
  const now = new Date().toISOString();
  const recoveryCodes = db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET totp_enabled = 1, totp_secret_enc = ?, updated_at = ?
       WHERE id = ?`,
    ).run(pending.secret_enc, now, userId);
    db.prepare(`DELETE FROM admin_totp_setup WHERE user_id = ?`).run(userId);
    const codes = replaceRecoveryCodes(db, userId);
    revokeUserSessionsOn(db, userId);
    return codes;
  })();
  recordSecurityEvent(db, {
    userId,
    action: "totp_setup_verify",
    success: true,
    ipHash: ctx.ipHash,
    uaHash: ctx.uaHash,
  });
  return { ok: true as const, recoveryCodes };
}

function consumeRecoveryCode(
  db: Database.Database,
  userId: number,
  code: string,
) {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length < 8) return false;
  const hash = recoveryCodeHash(userId, normalized);
  const row = db
    .prepare(
      `SELECT id FROM admin_recovery_codes
       WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`,
    )
    .get(userId, hash) as { id: number } | undefined;
  if (!row) return false;
  db.prepare(`UPDATE admin_recovery_codes SET used_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    row.id,
  );
  return true;
}

function verifyAdminSecondFactor(
  db: Database.Database,
  userId: number,
  secretEnc: string | null,
  code: string,
) {
  const totpOk = secretEnc
    ? (() => {
        const secret = decryptSecret(secretEnc);
        return secret ? verifyTotpCode(secret, code) : false;
      })()
    : false;
  if (totpOk) return { ok: true as const, via: "totp" as const };
  if (consumeRecoveryCode(db, userId, code)) {
    return { ok: true as const, via: "recovery" as const };
  }
  return { ok: false as const };
}

export function disableTotp(
  db: Database.Database,
  user: { id: number; totp_secret_enc: string | null; totp_enabled?: number },
  code: string,
  ctx: { ipHash?: string | null; uaHash?: string | null },
) {
  if (!totpEnabledOn(db, user.id)) {
    return { ok: false as const, error: "2FA zaten kapalı.", status: 400 };
  }
  const verified = verifyAdminSecondFactor(
    db,
    user.id,
    user.totp_secret_enc,
    code,
  );
  if (!verified.ok) {
    recordSecurityEvent(db, {
      userId: user.id,
      action: "totp_disable",
      success: false,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
    return { ok: false as const, error: "Doğrulama kodu hatalı.", status: 401 };
  }
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET totp_enabled = 0, totp_secret_enc = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(now, user.id);
    db.prepare(`DELETE FROM admin_totp_setup WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM admin_recovery_codes WHERE user_id = ?`).run(user.id);
    revokeUserSessionsOn(db, user.id);
  })();
  recordSecurityEvent(db, {
    userId: user.id,
    action: "totp_disable",
    success: true,
    ipHash: ctx.ipHash,
    uaHash: ctx.uaHash,
  });
  if (verified.via === "recovery") {
    recordSecurityEvent(db, {
      userId: user.id,
      action: "recovery_code_used",
      success: true,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
  }
  return { ok: true as const };
}

export function createLoginChallenge(db: Database.Database, userId: number) {
  const raw = newToken();
  const now = Date.now();
  db.prepare(
    `DELETE FROM admin_login_challenges
     WHERE user_id = ? OR expires_at < ? OR consumed_at IS NOT NULL`,
  ).run(userId, new Date().toISOString());
  db.prepare(
    `INSERT INTO admin_login_challenges
     (user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    userId,
    hmac(`admin-2fa:${raw}`),
    new Date(now + ADMIN_2FA_CHALLENGE_TTL_MS).toISOString(),
    new Date(now).toISOString(),
  );
  return raw;
}

export function completeLoginChallenge(
  db: Database.Database,
  rawToken: string,
  code: string,
  ctx: { ipHash: string; uaHash?: string | null },
):
  | { ok: true; userId: number; via: "totp" | "recovery" }
  | { ok: false; error: string; status: number } {
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, consumed_at
       FROM admin_login_challenges WHERE token_hash = ?`,
    )
    .get(hmac(`admin-2fa:${rawToken}`)) as
    | {
        id: number;
        user_id: number;
        expires_at: string;
        consumed_at: string | null;
      }
    | undefined;
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Doğrulama kodu hatalı.", status: 401 };
  }
  if (totpVerifyLimited(db, ctx.ipHash, row.user_id)) {
    return { ok: false, error: "Çok fazla deneme. Biraz sonra dene.", status: 429 };
  }
  noteTotpVerifyAttempt(db, ctx.ipHash, row.user_id);

  const user = db
    .prepare(
      `SELECT id, role, totp_enabled, totp_secret_enc FROM users WHERE id = ?`,
    )
    .get(row.user_id) as
    | {
        id: number;
        role: string;
        totp_enabled: number;
        totp_secret_enc: string | null;
      }
    | undefined;
  if (!user || user.role !== "admin" || Number(user.totp_enabled) !== 1) {
    return { ok: false, error: "Doğrulama kodu hatalı.", status: 401 };
  }

  const verified = verifyAdminSecondFactor(
    db,
    user.id,
    user.totp_secret_enc,
    code,
  );
  if (!verified.ok) {
    recordSecurityEvent(db, {
      userId: user.id,
      action: "totp_login_failure",
      success: false,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
    return { ok: false, error: "Doğrulama kodu hatalı.", status: 401 };
  }

  db.prepare(
    `UPDATE admin_login_challenges SET consumed_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), row.id);

  recordSecurityEvent(db, {
    userId: user.id,
    action: "totp_login_success",
    success: true,
    ipHash: ctx.ipHash,
    uaHash: ctx.uaHash,
  });
  if (verified.via === "recovery") {
    recordSecurityEvent(db, {
      userId: user.id,
      action: "recovery_code_used",
      success: true,
      ipHash: ctx.ipHash,
      uaHash: ctx.uaHash,
    });
  }
  return { ok: true, userId: user.id, via: verified.via };
}

export function updateUserPasswordHashOn(
  db: Database.Database,
  userId: number,
  passwordHash: string,
) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
  ).run(passwordHash, now, userId);
  revokeUserSessionsOn(db, userId);
}
