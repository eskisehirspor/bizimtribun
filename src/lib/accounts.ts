import type Database from "better-sqlite3";
import { hmac, identityPhoneHash, newToken } from "./crypto";
import { writeAudit } from "./audit";
import { castFanVote, findFanVote, voidFanVote } from "./fan-votes";
import {
  PHONE_HOLD_MS,
  PHONE_HOLD_PERMANENT_UNTIL,
  PHONE_HOLD_VOTED_MS,
  SIGNUP_TICKET_TTL_MS,
  TERMS_VERSION,
} from "./policy";
import { isProvince } from "./provinces";
import { isUserBanned, isUsername, normalizeUsername, type UserRow } from "./users";
import { isReservedName } from "./name";

function ticketHash(raw: string) {
  return hmac(`signup-ticket:${raw}`);
}

export function findVerifiedUserByPhone(db: Database.Database, phoneNorm: string) {
  return db
    .prepare(
      `SELECT * FROM users
       WHERE phone_norm = ? AND phone_verified_at IS NOT NULL AND deleted_at IS NULL`,
    )
    .get(phoneNorm) as UserRow | undefined;
}

/** A password account that typed this number at sign-up but never verified it. */
export function hasUnverifiedClaim(db: Database.Database, phoneNorm: string) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM users
         WHERE phone_norm = ? AND phone_verified_at IS NULL AND deleted_at IS NULL LIMIT 1`,
      )
      .get(phoneNorm),
  );
}

export function phoneHoldActive(db: Database.Database, phoneNorm: string) {
  const row = db
    .prepare(`SELECT release_at FROM phone_holds WHERE phone_hash = ?`)
    .get(identityPhoneHash(phoneNorm)) as { release_at: string } | undefined;
  return Boolean(row && new Date(row.release_at).getTime() > Date.now());
}

export const PHONE_HOLD_ERROR =
  "Bu numarayla silinmiş bir hesap var ve bu numarayla yeni hesap açma süresi henüz dolmadı.";

export function issueSignupTicket(db: Database.Database, phoneNorm: string) {
  const raw = newToken();
  const now = new Date();
  db.prepare(
    `INSERT INTO signup_tickets (token_hash, phone_norm, phone_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    ticketHash(raw),
    phoneNorm,
    identityPhoneHash(phoneNorm),
    new Date(now.getTime() + SIGNUP_TICKET_TTL_MS).toISOString(),
    now.toISOString(),
  );
  return raw;
}

export function lookupSignupTicket(db: Database.Database, raw: string | null | undefined) {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const row = db
    .prepare(
      `SELECT id, phone_norm, expires_at, consumed_at FROM signup_tickets WHERE token_hash = ?`,
    )
    .get(ticketHash(raw)) as
    | { id: number; phone_norm: string; expires_at: string; consumed_at: string | null }
    | undefined;
  if (!row || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { id: row.id, phoneNorm: row.phone_norm };
}

/**
 * Hands a verified phone to `userId`: any unverified claim on the same number
 * (old password sign-ups that never proved it) is cleared. Caller holds a
 * transaction and has checked there is no verified holder.
 */
function takePhone(db: Database.Database, userId: number, phoneNorm: string, now: string) {
  db.prepare(
    `UPDATE users SET phone = NULL, phone_norm = NULL, updated_at = ?
     WHERE phone_norm = ? AND phone_verified_at IS NULL AND id != ?`,
  ).run(now, phoneNorm, userId);
}

export type SignupInput = {
  ticketRaw: string | null | undefined;
  username: string;
  displayName?: string | null;
  city?: string | null;
  teamId: string;
};

export type SignupResult =
  | { ok: true; userId: number }
  | { ok: false; status: number; error: string };

/**
 * Creates the account and its permanent team vote in one transaction, so a
 * failed vote never leaves a half-registered account behind.
 */
export function signupWithTicket(db: Database.Database, input: SignupInput): SignupResult {
  const usernameNorm = normalizeUsername(input.username);
  if (!isUsername(usernameNorm)) {
    return {
      ok: false,
      status: 400,
      error: "Kullanıcı adı 3–20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi.",
    };
  }
  if (usernameNorm.startsWith("silinmis_") || isReservedName(usernameNorm)) {
    return { ok: false, status: 400, error: "Bu kullanıcı adı kullanılamaz." };
  }
  const displayName = (input.displayName ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (displayName && /[<>]/.test(displayName)) {
    return { ok: false, status: 400, error: "Görünen ad < veya > içeremez." };
  }
  if (displayName && isReservedName(displayName)) {
    return { ok: false, status: 400, error: "Bu görünen ad kullanılamaz." };
  }
  const city = input.city?.trim() || null;
  if (city && !isProvince(city)) {
    return { ok: false, status: 400, error: "İl geçersiz." };
  }

  try {
    return db.transaction((): SignupResult => {
      const ticket = lookupSignupTicket(db, input.ticketRaw);
      if (!ticket) {
        return {
          ok: false,
          status: 401,
          error: "Telefon doğrulamanın süresi doldu. Kodu yeniden iste.",
        };
      }
      if (findVerifiedUserByPhone(db, ticket.phoneNorm)) {
        return { ok: false, status: 409, error: "Bu telefonla zaten bir hesap var. Giriş yap." };
      }
      if (phoneHoldActive(db, ticket.phoneNorm)) {
        return { ok: false, status: 409, error: PHONE_HOLD_ERROR };
      }
      if (
        db.prepare(`SELECT 1 FROM users WHERE username_norm = ?`).get(usernameNorm)
      ) {
        return { ok: false, status: 409, error: "Bu kullanıcı adı alınmış." };
      }

      const now = new Date().toISOString();
      const used = db
        .prepare(`UPDATE signup_tickets SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
        .run(now, ticket.id);
      if (used.changes !== 1) {
        return { ok: false, status: 401, error: "Telefon doğrulamanın süresi doldu. Kodu yeniden iste." };
      }

      takePhone(db, -1, ticket.phoneNorm, now);
      const info = db
        .prepare(
          `INSERT INTO users
           (username, username_norm, display_name, status, role, created_at, updated_at,
            phone, phone_norm, phone_verified_at, city, terms_version, terms_accepted_at)
           VALUES (?, ?, ?, 'active', 'user', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          usernameNorm,
          usernameNorm,
          displayName || usernameNorm,
          now,
          now,
          `+90${ticket.phoneNorm}`,
          ticket.phoneNorm,
          now,
          city,
          TERMS_VERSION,
          now,
        );
      const userId = Number(info.lastInsertRowid);
      const vote = castFanVote(db, { userId, teamId: input.teamId, city });
      if (!vote.ok) throw new SignupAbort(vote.status, vote.error);
      writeAudit(db, {
        actorUserId: userId,
        action: "account_signup",
        targetType: "user",
        targetId: userId,
      });
      return { ok: true, userId };
    })();
  } catch (err) {
    if (err instanceof SignupAbort) return { ok: false, status: err.status, error: err.message };
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
    if (code.includes("CONSTRAINT")) {
      return { ok: false, status: 409, error: "Bu kullanıcı adı veya telefon zaten kayıtlı." };
    }
    return { ok: false, status: 500, error: "Kayıt tamamlanamadı. Biraz sonra dene." };
  }
}

class SignupAbort extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Existing (password) account proves a phone by SMS and keeps it. */
export function bindVerifiedPhone(
  db: Database.Database,
  userId: number,
  phoneNorm: string,
): { ok: true } | { ok: false; status: number; error: string } {
  return db.transaction(() => {
    const holder = findVerifiedUserByPhone(db, phoneNorm);
    if (holder && holder.id !== userId) {
      return { ok: false as const, status: 409, error: "Bu telefon başka bir hesapta doğrulanmış." };
    }
    if (phoneHoldActive(db, phoneNorm)) {
      return { ok: false as const, status: 409, error: PHONE_HOLD_ERROR };
    }
    const user = db
      .prepare(`SELECT phone_verified_at, deleted_at FROM users WHERE id = ?`)
      .get(userId) as { phone_verified_at: string | null; deleted_at: string | null } | undefined;
    if (!user || user.deleted_at) {
      return { ok: false as const, status: 404, error: "Hesap bulunamadı." };
    }
    if (user.phone_verified_at && findFanVote(db, userId)) {
      // Swapping the verified phone of an account that already voted would let
      // one number vouch for many votes over time.
      return {
        ok: false as const,
        status: 409,
        error: "Oy vermiş bir hesabın doğrulanmış telefonu değiştirilemez.",
      };
    }
    const now = new Date().toISOString();
    takePhone(db, userId, phoneNorm, now);
    db.prepare(
      `UPDATE users SET phone = ?, phone_norm = ?, phone_verified_at = ?, updated_at = ? WHERE id = ?`,
    ).run(`+90${phoneNorm}`, phoneNorm, now, now, userId);
    writeAudit(db, {
      actorUserId: userId,
      action: "phone_bound",
      targetType: "user",
      targetId: userId,
    });
    return { ok: true as const };
  })();
}

/**
 * Account deletion policy (also in docs/data-policy.md):
 * - the team vote is voided in the same transaction, so it leaves every count;
 * - name, e-mail, phone, birth date, city, password and 2FA secrets are erased,
 *   the username becomes `silinmis_<id>`;
 * - forum posts stay, shown under "Silinmiş üye";
 * - a keyed HMAC of the phone is held so the same number cannot open a new
 *   account and vote again right away: 30 days without a vote, a year after a
 *   vote, and with no end date when the account was banned at deletion (so a
 *   ban can't be escaped by deleting). Expired holds are purged.
 */
export function deleteAccount(
  db: Database.Database,
  input: { userId: number; actorUserId: number | null; reason: string },
): { ok: true } | { ok: false; status: number; error: string } {
  return db.transaction(() => {
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(input.userId) as
      | UserRow
      | undefined;
    if (!user || user.deleted_at) {
      return { ok: false as const, status: 404, error: "Hesap bulunamadı." };
    }
    if (user.role === "super_admin" || user.role === "admin") {
      return {
        ok: false as const,
        status: 409,
        error: "Yönetici hesabı silinmeden önce yetkisi kaldırılmalı.",
      };
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const vote = findFanVote(db, user.id);
    if (vote && vote.status === "active") {
      voidFanVote(db, {
        userId: user.id,
        reason: "account_deleted",
        actorUserId: input.actorUserId,
        action: "fan_vote_void_account_deleted",
      });
    }
    if (user.phone_norm && user.phone_verified_at) {
      const banned = isUserBanned(user);
      const releaseAt = banned
        ? PHONE_HOLD_PERMANENT_UNTIL
        : new Date(now.getTime() + (vote ? PHONE_HOLD_VOTED_MS : PHONE_HOLD_MS)).toISOString();
      const reason = banned ? "account_deleted_banned" : vote ? "account_deleted_voted" : "account_deleted";
      // A longer hold already on the number is never shortened.
      db.prepare(
        `INSERT INTO phone_holds (phone_hash, reason, release_at, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(phone_hash) DO UPDATE SET
           release_at = MAX(release_at, excluded.release_at),
           reason = CASE WHEN excluded.release_at > release_at THEN excluded.reason ELSE reason END`,
      ).run(identityPhoneHash(user.phone_norm), reason, releaseAt, nowIso);
    }
    const anon = `silinmis_${user.id}`;
    db.prepare(
      `UPDATE users SET
         username = ?, username_norm = ?, display_name = 'Silinmiş üye',
         email = NULL, email_norm = NULL, password_hash = NULL,
         first_name = NULL, last_name = NULL, birth_date = NULL,
         phone = NULL, phone_norm = NULL, city = NULL,
         bio = NULL, avatar = NULL, show_city = 0, profile_visibility = 'members',
         totp_enabled = 0, totp_secret_enc = NULL,
         status = 'deleted', deleted_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(anon, anon, nowIso, nowIso, user.id);
    db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
      nowIso,
      user.id,
    );
    db.prepare(`DELETE FROM auth_otps WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM user_badges WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM user_email_tokens WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM admin_recovery_codes WHERE user_id = ?`).run(user.id);
    db.prepare(`DELETE FROM admin_totp_setup WHERE user_id = ?`).run(user.id);
    writeAudit(db, {
      actorUserId: input.actorUserId,
      action: "account_deleted",
      targetType: "user",
      targetId: user.id,
      reason: input.reason,
    });
    return { ok: true as const };
  })();
}
