import type Database from "better-sqlite3";
import {
  OTP_PER_IP_HOUR,
  OTP_PER_PHONE_HOUR,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./policy";

export const OTP_REQUEST_GENERIC_MESSAGE =
  "İşleminiz alındı. Kayıt uygunsa doğrulama kodu iletilecek.";

export function otpRequestAcceptedBody(extra?: { devCode?: string }) {
  return {
    ok: true as const,
    message: OTP_REQUEST_GENERIC_MESSAGE,
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    ...(extra?.devCode ? { devCode: extra.devCode } : {}),
  };
}

function attemptCount(db: Database.Database, key: string, sinceIso: string) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM register_attempts
         WHERE ip_hash = ? AND created_at >= ?`,
      )
      .get(key, sinceIso) as { c: number }
  ).c;
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

export function otpRequestIpLimited(db: Database.Database, ipHash: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return attemptCount(db, ipHash, since) >= OTP_PER_IP_HOUR;
}

export function otpRequestPhoneLimited(db: Database.Database, phoneKey: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return attemptCount(db, phoneKey, since) >= OTP_PER_PHONE_HOUR;
}

export function otpRequestPhoneCoolingDown(
  db: Database.Database,
  phoneKey: string,
) {
  const last = lastAttemptAt(db, phoneKey);
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < OTP_RESEND_COOLDOWN_MS;
}

export function noteOtpRequestAttempt(db: Database.Database, key: string) {
  db.prepare(
    `INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`,
  ).run(key, new Date().toISOString());
}

export type OtpParticipantRow = {
  id: number;
  deleted_at: string | null;
  phone_verified_at: string | null;
};

export function findOtpParticipantByPhoneHash(
  db: Database.Database,
  phoneHash: string,
) {
  if (!phoneHash) return undefined;
  return db
    .prepare(`SELECT id, deleted_at, phone_verified_at FROM participants WHERE phone_hash = ?`)
    .get(phoneHash) as OtpParticipantRow | undefined;
}

export function participantEligibleForOtpSend(
  participant: OtpParticipantRow | null | undefined,
) {
  return Boolean(
    participant && !participant.deleted_at && !participant.phone_verified_at,
  );
}

export function preludeOtpRequest(
  db: Database.Database,
  input: { ipHash: string; phoneKey: string; phoneHash: string },
):
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      participant: OtpParticipantRow | undefined;
      dispatch: boolean;
    } {
  if (otpRequestIpLimited(db, input.ipHash)) {
    return { ok: false, error: "Çok fazla deneme. Biraz sonra dene.", status: 429 };
  }
  if (otpRequestPhoneLimited(db, input.phoneKey)) {
    return {
      ok: false,
      error: "Bu numaraya çok fazla kod gitti. Bir saat sonra dene.",
      status: 429,
    };
  }
  if (otpRequestPhoneCoolingDown(db, input.phoneKey)) {
    return { ok: false, error: "Yeni kod için biraz bekle.", status: 429 };
  }

  noteOtpRequestAttempt(db, input.ipHash);
  noteOtpRequestAttempt(db, input.phoneKey);

  const participant = findOtpParticipantByPhoneHash(db, input.phoneHash);
  return {
    ok: true,
    participant,
    dispatch: participantEligibleForOtpSend(participant),
  };
}
