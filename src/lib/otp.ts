import { randomInt } from "crypto";
import { getDb } from "./db";
import { otpCodeHash, safeEqual } from "./crypto";
import {
  OTP_MAX_ATTEMPTS,
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./policy";
import { getSmsProvider, isDevSmsInbox, smsDeliveryAvailable } from "./sms";

type OtpRow = {
  id: number;
  participant_id: number;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
  consumed_at: string | null;
  voided_at: string | null;
};

function newOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function voidOpenOtps(participantId: number, now: string) {
  getDb()
    .prepare(
      `UPDATE phone_otps
       SET voided_at = ?
       WHERE participant_id = ? AND consumed_at IS NULL AND voided_at IS NULL`,
    )
    .run(now, participantId);
}

export function voidParticipantOtps(participantId: number, now: string) {
  voidOpenOtps(participantId, now);
}

function phoneOtpCountSince(phoneHash: string, sinceIso: string) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM phone_otps
       WHERE phone_hash = ? AND created_at >= ?`,
    )
    .get(phoneHash, sinceIso) as { c: number };
  return row.c;
}

function lastOtpAt(phoneHash: string) {
  const row = getDb()
    .prepare(
      `SELECT created_at FROM phone_otps
       WHERE phone_hash = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(phoneHash) as { created_at: string } | undefined;
  return row?.created_at;
}

export async function requestPhoneOtp(input: {
  participantId: number;
  phoneNorm: string;
  phoneHash: string;
  alreadyVerified: boolean;
}) {
  if (input.alreadyVerified) {
    return { ok: false as const, error: "Telefon zaten doğrulanmış.", status: 409 };
  }

  if (!smsDeliveryAvailable()) {
    return {
      ok: false as const,
      error: "Telefon doğrulama henüz aktif değil.",
      status: 503,
    };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (phoneOtpCountSince(input.phoneHash, hourAgo) >= OTP_PER_PHONE_HOUR) {
    return {
      ok: false as const,
      error: "Bu numaraya çok fazla kod gitti. Bir saat sonra dene.",
      status: 429,
    };
  }

  const lastAt = lastOtpAt(input.phoneHash);
  if (
    lastAt &&
    Date.now() - new Date(lastAt).getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    return {
      ok: false as const,
      error: "Yeni kod için biraz bekle.",
      status: 429,
    };
  }

  const now = new Date().toISOString();
  const code = newOtpCode();
  const codeHash = otpCodeHash(input.participantId, code);
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

  getDb().transaction(() => {
    voidOpenOtps(input.participantId, now);
    getDb()
      .prepare(
        `INSERT INTO phone_otps
         (participant_id, phone_hash, code_hash, expires_at, attempts, max_attempts, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        input.participantId,
        input.phoneHash,
        codeHash,
        expires,
        OTP_MAX_ATTEMPTS,
        now,
      );
  })();

  try {
    await getSmsProvider().sendOtp({ phoneNorm: input.phoneNorm, code });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "SMS_NOT_CONFIGURED") {
      return {
        ok: false as const,
        error: "Telefon doğrulama henüz aktif değil.",
        status: 503,
      };
    }
    return {
      ok: false as const,
      error: "Kod gönderilemedi. Biraz sonra dene.",
      status: 502,
    };
  }

  return {
    ok: true as const,
    message: "Doğrulama kodu yola çıktı.",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    ...(isDevSmsInbox() ? { devCode: code } : {}),
  };
}

export function otpIpLimited(ipHash: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM register_attempts
       WHERE ip_hash = ? AND created_at >= ?`,
    )
    .get(ipHash, since) as { c: number };
  return row.c >= OTP_PER_IP_HOUR;
}

export function consumePhoneOtp(input: {
  participantId: number;
  phoneHash: string;
  code: string;
  teamId: string;
  city: string;
}) {
  const now = new Date().toISOString();
  const expected = otpCodeHash(input.participantId, input.code);

  try {
    getDb().transaction(() => {
      const row = getDb()
        .prepare(
          `SELECT id, participant_id, code_hash, expires_at, attempts, max_attempts,
                  consumed_at, voided_at
           FROM phone_otps
           WHERE participant_id = ? AND consumed_at IS NULL AND voided_at IS NULL
           ORDER BY id DESC LIMIT 1`,
        )
        .get(input.participantId) as OtpRow | undefined;

      if (!row) throw new Error("OTP_INVALID");
      if (new Date(row.expires_at).getTime() < Date.now()) {
        getDb()
          .prepare(`UPDATE phone_otps SET voided_at = ? WHERE id = ?`)
          .run(now, row.id);
        throw new Error("OTP_INVALID");
      }

      if (!safeEqual(row.code_hash, expected)) {
        const attempts = row.attempts + 1;
        if (attempts >= row.max_attempts) {
          getDb()
            .prepare(
              `UPDATE phone_otps SET attempts = ?, voided_at = ? WHERE id = ?`,
            )
            .run(attempts, now, row.id);
        } else {
          getDb()
            .prepare(`UPDATE phone_otps SET attempts = ? WHERE id = ?`)
            .run(attempts, row.id);
        }
        throw new Error("OTP_INVALID");
      }

      const consumed = getDb()
        .prepare(
          `UPDATE phone_otps
           SET consumed_at = ?
           WHERE id = ? AND consumed_at IS NULL AND voided_at IS NULL`,
        )
        .run(now, row.id);
      if (consumed.changes !== 1) throw new Error("OTP_INVALID");

      voidOpenOtps(input.participantId, now);

      const phoneHit = getDb()
        .prepare(
          `UPDATE participants
           SET phone_verified_at = ?
           WHERE id = ? AND deleted_at IS NULL AND phone_verified_at IS NULL
             AND phone_hash = ?`,
        )
        .run(now, input.participantId, input.phoneHash);
      if (phoneHit.changes !== 1) throw new Error("OTP_INVALID");
    })();
  } catch {
    return { ok: false as const, error: "Kod geçersiz veya süresi doldu." };
  }

  return { ok: true as const };
}
