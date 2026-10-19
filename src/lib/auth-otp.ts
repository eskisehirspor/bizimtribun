import { runHousekeepingIfDue } from "./housekeeping";
import { randomBytes, randomInt } from "crypto";
import type Database from "better-sqlite3";
import { hmac, identityPhoneHash, safeEqual } from "./crypto";
import {
  OTP_MAX_ATTEMPTS,
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_DAY,
  OTP_PER_PHONE_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OTP_VERIFY_PER_IP_HOUR,
  OTP_VERIFY_PER_PHONE_HOUR,
} from "./policy";
import { getSmsProvider, isDevSmsInbox, SmsSendError } from "./sms";

export type OtpPurpose = "login" | "bind";

type OtpRow = {
  id: number;
  salt: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function phoneKeyHash(phoneNorm: string) {
  return identityPhoneHash(phoneNorm);
}

function codeHash(salt: string, phoneHash: string, code: string) {
  return hmac(`auth-otp:${salt}:${phoneHash}:${code}`);
}

function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function since(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

/** Counts hits on an opaque rate-limit key (already hashed) since `ms` ago. */
export function rateCount(db: Database.Database, key: string, ms: number) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM register_attempts WHERE ip_hash = ? AND created_at >= ?`,
      )
      .get(key, since(ms)) as { c: number }
  ).c;
}

export function rateNote(db: Database.Database, key: string) {
  db.prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`).run(
    key,
    new Date().toISOString(),
  );
}

export type OtpRequestResult =
  | { ok: true; expiresInSec: number; devCode?: string }
  | { ok: false; status: number; error: string };

/**
 * Creates and sends a code. The caller has already validated the phone and
 * the CAPTCHA. Limits: per IP per hour, per phone per hour and per day,
 * and a resend cooldown per phone.
 */
export async function requestOtp(
  db: Database.Database,
  input: {
    phoneNorm: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): Promise<OtpRequestResult> {
  runHousekeepingIfDue(db);
  const phoneHash = phoneKeyHash(input.phoneNorm);
  const ipRateKey = hmac(`otp-send-ip:${input.ipKey}`);

  if (rateCount(db, ipRateKey, HOUR_MS) >= OTP_PER_IP_HOUR) {
    return { ok: false, status: 429, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }
  const phoneCounts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as hour,
         COUNT(*) as day,
         MAX(created_at) as last
       FROM auth_otps WHERE phone_hash = ? AND created_at >= ?`,
    )
    .get(since(HOUR_MS), phoneHash, since(DAY_MS)) as {
    hour: number | null;
    day: number;
    last: string | null;
  };
  if ((phoneCounts.hour ?? 0) >= OTP_PER_PHONE_HOUR || phoneCounts.day >= OTP_PER_PHONE_DAY) {
    return {
      ok: false,
      status: 429,
      error: "Bu numaraya çok fazla kod gönderildi. Daha sonra tekrar dene.",
    };
  }
  if (
    phoneCounts.last &&
    Date.now() - new Date(phoneCounts.last).getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    const wait = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(phoneCounts.last).getTime())) / 1000,
    );
    return {
      ok: false,
      status: 429,
      error: `Yeni kod istemek için ${wait} saniye bekle.`,
    };
  }

  const provider = getSmsProvider();
  if (provider.name === "none") {
    return {
      ok: false,
      status: 503,
      error: "SMS doğrulama şu anda kullanılamıyor. Daha sonra tekrar dene.",
    };
  }

  rateNote(db, ipRateKey);
  const now = new Date().toISOString();
  const code = newCode();
  const salt = randomBytes(16).toString("hex");
  const id = db.transaction(() => {
    db.prepare(
      `UPDATE auth_otps SET voided_at = ?
       WHERE phone_hash = ? AND purpose = ? AND consumed_at IS NULL AND voided_at IS NULL`,
    ).run(now, phoneHash, input.purpose);
    const info = db
      .prepare(
        `INSERT INTO auth_otps
         (phone_hash, purpose, user_id, salt, code_hash, expires_at, attempts, max_attempts, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        phoneHash,
        input.purpose,
        input.userId ?? null,
        salt,
        codeHash(salt, phoneHash, code),
        new Date(Date.now() + OTP_TTL_MS).toISOString(),
        OTP_MAX_ATTEMPTS,
        now,
      );
    return Number(info.lastInsertRowid);
  })();

  try {
    await provider.sendOtp({ phoneNorm: input.phoneNorm, code });
  } catch (err) {
    db.prepare(`UPDATE auth_otps SET voided_at = ? WHERE id = ? AND voided_at IS NULL`).run(
      new Date().toISOString(),
      id,
    );
    if (err instanceof SmsSendError && err.message === "SMS_NOT_CONFIGURED") {
      return {
        ok: false,
        status: 503,
        error: "SMS doğrulama şu anda kullanılamıyor. Daha sonra tekrar dene.",
      };
    }
    return { ok: false, status: 502, error: "Kod gönderilemedi. Biraz sonra tekrar dene." };
  }

  return {
    ok: true,
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    ...(isDevSmsInbox() ? { devCode: code } : {}),
  };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const INVALID = { ok: false as const, status: 400, error: "Kod hatalı veya süresi dolmuş." };

/**
 * Checks a code against the newest open code for this phone and purpose.
 * Every wrong guess counts; the code is voided at max_attempts. A right code
 * is consumed exactly once even under concurrent requests.
 */
export function verifyOtp(
  db: Database.Database,
  input: {
    phoneNorm: string;
    code: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): OtpVerifyResult {
  const phoneHash = phoneKeyHash(input.phoneNorm);
  const ipRateKey = hmac(`otp-verify-ip:${input.ipKey}`);
  const phoneRateKey = hmac(`otp-verify-phone:${phoneHash}`);
  if (
    rateCount(db, ipRateKey, HOUR_MS) >= OTP_VERIFY_PER_IP_HOUR ||
    rateCount(db, phoneRateKey, HOUR_MS) >= OTP_VERIFY_PER_PHONE_HOUR
  ) {
    return { ok: false, status: 429, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }
  rateNote(db, ipRateKey);
  rateNote(db, phoneRateKey);

  if (!/^\d{6}$/.test(input.code)) return INVALID;

  const now = new Date().toISOString();
  return db.transaction((): OtpVerifyResult => {
    const row = db
      .prepare(
        `SELECT id, salt, code_hash, expires_at, attempts, max_attempts
         FROM auth_otps
         WHERE phone_hash = ? AND purpose = ? AND consumed_at IS NULL AND voided_at IS NULL
           AND (? IS NULL OR user_id = ?)
         ORDER BY id DESC LIMIT 1`,
      )
      .get(phoneHash, input.purpose, input.userId ?? null, input.userId ?? null) as
      | OtpRow
      | undefined;
    if (!row) return INVALID;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      db.prepare(`UPDATE auth_otps SET voided_at = ? WHERE id = ?`).run(now, row.id);
      return INVALID;
    }
    if (!safeEqual(row.code_hash, codeHash(row.salt, phoneHash, input.code))) {
      const attempts = row.attempts + 1;
      db.prepare(
        `UPDATE auth_otps SET attempts = ?, voided_at = CASE WHEN ? >= max_attempts THEN ? ELSE voided_at END
         WHERE id = ?`,
      ).run(attempts, attempts, now, row.id);
      return INVALID;
    }
    const hit = db
      .prepare(
        `UPDATE auth_otps SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL AND voided_at IS NULL`,
      )
      .run(now, row.id);
    if (hit.changes !== 1) return INVALID;
    return { ok: true };
  })();
}

/** Housekeeping: drop expired codes, tickets and finished phone holds. */
export function purgeExpiredAuthRows(db: Database.Database) {
  const now = new Date().toISOString();
  db.prepare(`DELETE FROM auth_otps WHERE created_at < ?`).run(since(2 * DAY_MS));
  db.prepare(`DELETE FROM signup_tickets WHERE expires_at < ?`).run(now);
  db.prepare(`DELETE FROM phone_holds WHERE release_at < ?`).run(now);
  db.prepare(`DELETE FROM register_attempts WHERE created_at < ?`).run(since(2 * DAY_MS));
}
