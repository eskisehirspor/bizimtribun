import { runHousekeepingIfDue } from "./housekeeping";
import { randomBytes, randomInt } from "crypto";
import type { Db } from "./db";
import { hmac, identityEmailHash, identityPhoneHash, safeEqual } from "./crypto";
import { isDevMailInbox, mailConfigured, sendOtpEmail } from "./mail";
import {
  OTP_MAX_ATTEMPTS,
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_DAY,
  OTP_PER_PHONE_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OTP_VERIFY_PER_IP_HOUR,
  OTP_VERIFY_PER_PHONE_HOUR,
  DEVICE_SIGNUP_WINDOW_MS,
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

export function emailKeyHash(emailNorm: string) {
  return identityEmailHash(emailNorm);
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
export async function rateCount(db: Db, key: string, ms: number) {
  return (
    await db
            .prepare(
              `SELECT COUNT(*) as c FROM register_attempts WHERE ip_hash = ? AND created_at >= ?`,
            )
            .get(key, since(ms)) as { c: number }
  ).c;
}

export async function rateNote(db: Db, key: string) {
  await db.prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`).run(
        key,
        new Date().toISOString(),
      );
}

export type OtpRequestResult =
  | { ok: true; expiresInSec: number; devCode?: string }
  | { ok: false; status: number; error: string };

/** Where a code goes: an SMS to a phone or a mail to an inbox. */
type OtpTarget = {
  /** HMAC of the phone or the normalised e-mail; stored in auth_otps.phone_hash. */
  keyHash: string;
  tooManyError: string;
  unavailableError: string;
  /** Returns false when the channel is not configured. */
  available(): boolean;
  /** Throws "NOT_CONFIGURED" when the channel cannot send. */
  send(code: string): Promise<void>;
  devInbox(): boolean;
};

const SMS_UNAVAILABLE = "SMS doğrulama şu anda kullanılamıyor. Daha sonra tekrar dene.";
const MAIL_UNAVAILABLE = "E-posta doğrulama şu anda kullanılamıyor. Daha sonra tekrar dene.";

function smsTarget(phoneNorm: string): OtpTarget {
  return {
    keyHash: phoneKeyHash(phoneNorm),
    tooManyError: "Bu numaraya çok fazla kod gönderildi. Daha sonra tekrar dene.",
    unavailableError: SMS_UNAVAILABLE,
    available: () => getSmsProvider().name !== "none",
    async send(code) {
      try {
        await getSmsProvider().sendOtp({ phoneNorm, code });
      } catch (err) {
        if (err instanceof SmsSendError && err.message === "SMS_NOT_CONFIGURED") {
          throw new Error("NOT_CONFIGURED");
        }
        throw err;
      }
    },
    devInbox: isDevSmsInbox,
  };
}

function emailTarget(emailNorm: string, emailTo: string): OtpTarget {
  return {
    keyHash: emailKeyHash(emailNorm),
    tooManyError: "Bu adrese çok fazla kod gönderildi. Daha sonra tekrar dene.",
    unavailableError: MAIL_UNAVAILABLE,
    available: mailConfigured,
    async send(code) {
      await sendOtpEmail(emailTo, code);
    },
    devInbox: isDevMailInbox,
  };
}

/**
 * Creates and sends a code. The caller has already validated the phone and
 * the CAPTCHA. Limits: per IP per hour, per phone per hour and per day,
 * and a resend cooldown per phone.
 */
export async function requestOtp(
  db: Db,
  input: {
    phoneNorm: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): Promise<OtpRequestResult> {
  return requestCode(db, smsTarget(input.phoneNorm), input);
}

/** Same as requestOtp, for an e-mail address (already normalised and checked). */
export async function requestEmailOtp(
  db: Db,
  input: {
    emailNorm: string;
    /** The address as typed; the mail goes here. */
    emailTo: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): Promise<OtpRequestResult> {
  return requestCode(db, emailTarget(input.emailNorm, input.emailTo), input);
}

async function requestCode(
  db: Db,
  target: OtpTarget,
  input: { ipKey: string; purpose: OtpPurpose; userId?: number | null },
): Promise<OtpRequestResult> {
  await runHousekeepingIfDue(db);
  const phoneHash = target.keyHash;
  const ipRateKey = hmac(`otp-send-ip:${input.ipKey}`);

  if (await rateCount(db, ipRateKey, HOUR_MS) >= OTP_PER_IP_HOUR) {
    return { ok: false, status: 429, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }
  const phoneCounts = await db
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
    return { ok: false, status: 429, error: target.tooManyError };
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

  if (!target.available()) {
    return { ok: false, status: 503, error: target.unavailableError };
  }

  await rateNote(db, ipRateKey);
  const now = new Date().toISOString();
  const code = newCode();
  const salt = randomBytes(16).toString("hex");
  const id = await db.transaction(async () => {
      await db.prepare(
              `UPDATE auth_otps SET voided_at = ?
       WHERE phone_hash = ? AND purpose = ? AND consumed_at IS NULL AND voided_at IS NULL`,
            ).run(now, phoneHash, input.purpose);
      const info = await db
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
    await target.send(code);
  } catch (err) {
    await db.prepare(`UPDATE auth_otps SET voided_at = ? WHERE id = ? AND voided_at IS NULL`).run(
            new Date().toISOString(),
            id,
          );
    if (err instanceof Error && err.message === "NOT_CONFIGURED") {
      return { ok: false, status: 503, error: target.unavailableError };
    }
    return { ok: false, status: 502, error: "Kod gönderilemedi. Biraz sonra tekrar dene." };
  }

  return {
    ok: true,
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    ...(target.devInbox() ? { devCode: code } : {}),
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
export async function verifyOtp(
  db: Db,
  input: {
    phoneNorm: string;
    code: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): Promise<OtpVerifyResult> {
  return verifyCode(db, phoneKeyHash(input.phoneNorm), input);
}

export async function verifyEmailOtp(
  db: Db,
  input: {
    emailNorm: string;
    code: string;
    ipKey: string;
    purpose: OtpPurpose;
    userId?: number | null;
  },
): Promise<OtpVerifyResult> {
  return verifyCode(db, emailKeyHash(input.emailNorm), input);
}

async function verifyCode(
  db: Db,
  phoneHash: string,
  input: { code: string; ipKey: string; purpose: OtpPurpose; userId?: number | null },
): Promise<OtpVerifyResult> {
  const ipRateKey = hmac(`otp-verify-ip:${input.ipKey}`);
  const phoneRateKey = hmac(`otp-verify-phone:${phoneHash}`);
  if (
    await rateCount(db, ipRateKey, HOUR_MS) >= OTP_VERIFY_PER_IP_HOUR ||
    await rateCount(db, phoneRateKey, HOUR_MS) >= OTP_VERIFY_PER_PHONE_HOUR
  ) {
    return { ok: false, status: 429, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }
  await rateNote(db, ipRateKey);
  await rateNote(db, phoneRateKey);

  if (!/^\d{6}$/.test(input.code)) return INVALID;

  const now = new Date().toISOString();
  return db.transaction(async (): Promise<OtpVerifyResult> => {
    const row = await db
          .prepare(
            `SELECT id, salt, code_hash, expires_at, attempts, max_attempts
         FROM auth_otps
         WHERE phone_hash = ? AND purpose = ? AND consumed_at IS NULL AND voided_at IS NULL
           AND (?::integer IS NULL OR user_id = ?::integer)
         ORDER BY id DESC LIMIT 1`,
          )
          .get(phoneHash, input.purpose, input.userId ?? null, input.userId ?? null) as
      | OtpRow
      | undefined;
    if (!row) return INVALID;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await db.prepare(`UPDATE auth_otps SET voided_at = ? WHERE id = ?`).run(now, row.id);
      return INVALID;
    }
    if (!safeEqual(row.code_hash, codeHash(row.salt, phoneHash, input.code))) {
      const attempts = row.attempts + 1;
      await db.prepare(
                `UPDATE auth_otps SET attempts = ?, voided_at = CASE WHEN ? >= max_attempts THEN ? ELSE voided_at END
         WHERE id = ?`,
              ).run(attempts, attempts, now, row.id);
      return INVALID;
    }
    const hit = await db
          .prepare(
            `UPDATE auth_otps SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL AND voided_at IS NULL`,
          )
          .run(now, row.id);
    if (hit.changes !== 1) return INVALID;
    return { ok: true };
  })();
}

/** Housekeeping: drop expired codes, tickets, finished holds and old device rows. */
export async function purgeExpiredAuthRows(db: Db) {
  const now = new Date().toISOString();
  await db.prepare(`DELETE FROM auth_otps WHERE created_at < ?`).run(since(2 * DAY_MS));
  await db.prepare(`DELETE FROM signup_tickets WHERE expires_at < ?`).run(now);
  await db.prepare(`DELETE FROM phone_holds WHERE release_at < ?`).run(now);
  await db.prepare(`DELETE FROM device_signups WHERE created_at < ?`).run(since(DEVICE_SIGNUP_WINDOW_MS));
  await db.prepare(`DELETE FROM register_attempts WHERE created_at < ?`).run(since(2 * DAY_MS));
  // Ended sessions are kept 30 days for "where am I signed in" questions, then dropped.
  await db.prepare(`DELETE FROM sessions WHERE expires_at < ? OR revoked_at < ?`).run(since(30 * DAY_MS), since(30 * DAY_MS));
  // Security events hold only hashed IP / browser data; kept one year.
  await db.prepare(`DELETE FROM security_events WHERE created_at < ?`).run(since(365 * DAY_MS));
}
