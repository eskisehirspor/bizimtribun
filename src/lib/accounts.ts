import { isConstraintViolation, type Db } from "./db";
import { hmac, identityEmailHash, identityPhoneHash, newToken } from "./crypto";
import { deviceLimitReached, DEVICE_LIMIT_ERROR, noteDeviceSignup } from "./device-limit";
import { writeAudit } from "./audit";
import { castFanVote, findFanVote, voidFanVote } from "./fan-votes";
import { recordLegalAcceptance } from "./legal";
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
import { isUsernameReserved } from "./reserved-usernames";
import { isTrMobile, normalizePhone } from "./phone";
import { hashPassword, isStrongPassword } from "./password";

function ticketHash(raw: string) {
  return hmac(`signup-ticket:${raw}`);
}

export async function findVerifiedUserByPhone(db: Db, phoneNorm: string) {
  return await db
      .prepare(
        `SELECT * FROM users
       WHERE phone_norm = ? AND phone_verified_at IS NOT NULL AND deleted_at IS NULL`,
      )
      .get(phoneNorm) as UserRow | undefined;
}

/** A password account that typed this number at sign-up but never verified it. */
export async function hasUnverifiedClaim(db: Db, phoneNorm: string) {
  return Boolean(
    await db
            .prepare(
              `SELECT 1 FROM users
         WHERE phone_norm = ? AND phone_verified_at IS NULL AND deleted_at IS NULL LIMIT 1`,
            )
            .get(phoneNorm),
  );
}

async function holdActive(db: Db, hash: string) {
  const row = await db
      .prepare(`SELECT release_at FROM phone_holds WHERE phone_hash = ?`)
      .get(hash) as { release_at: string } | undefined;
  return Boolean(row && new Date(row.release_at).getTime() > Date.now());
}

export function phoneHoldActive(db: Db, phoneNorm: string) {
  return holdActive(db, identityPhoneHash(phoneNorm));
}

/** Same hold for e-mail accounts; phone_holds keys are HMACs, so both fit. */
export function emailHoldActive(db: Db, emailNorm: string) {
  return holdActive(db, identityEmailHash(emailNorm));
}

export const PHONE_HOLD_ERROR =
  "Bu numarayla silinmiş bir hesap var ve bu numarayla yeni hesap açma süresi henüz dolmadı.";
export const EMAIL_HOLD_ERROR =
  "Bu e-postayla silinmiş bir hesap var ve bu adresle yeni hesap açma süresi henüz dolmadı.";

export async function findVerifiedUserByEmail(db: Db, emailNorm: string) {
  return await db
      .prepare(
        `SELECT * FROM users
       WHERE email_norm = ? AND email_verified_at IS NOT NULL AND deleted_at IS NULL`,
      )
      .get(emailNorm) as UserRow | undefined;
}

/** An old password account that typed this e-mail but never confirmed it. */
export async function hasUnverifiedEmailClaim(db: Db, emailNorm: string) {
  return Boolean(
    await db
            .prepare(
              `SELECT 1 FROM users
         WHERE email_norm = ? AND email_verified_at IS NULL AND deleted_at IS NULL LIMIT 1`,
            )
            .get(emailNorm),
  );
}

export type TicketIdentity =
  | { channel: "sms"; phoneNorm: string }
  | { channel: "email"; email: string; emailNorm: string };

export async function issueSignupTicket(db: Db, identity: TicketIdentity | string) {
  const id: TicketIdentity =
    typeof identity === "string" ? { channel: "sms", phoneNorm: identity } : identity;
  const raw = newToken();
  const now = new Date();
  await db.prepare(
        `INSERT INTO signup_tickets
     (token_hash, channel, phone_norm, email, email_norm, identity_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ticketHash(raw),
        id.channel,
        id.channel === "sms" ? id.phoneNorm : null,
        id.channel === "email" ? id.email : null,
        id.channel === "email" ? id.emailNorm : null,
        id.channel === "sms" ? identityPhoneHash(id.phoneNorm) : identityEmailHash(id.emailNorm),
        new Date(now.getTime() + SIGNUP_TICKET_TTL_MS).toISOString(),
        now.toISOString(),
      );
  return raw;
}

export type SignupTicket = { id: number } & TicketIdentity;

export async function lookupSignupTicket(
  db: Db,
  raw: string | null | undefined,
): Promise<SignupTicket | null> {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const row = await db
      .prepare(
        `SELECT id, channel, phone_norm, email, email_norm, expires_at, consumed_at
       FROM signup_tickets WHERE token_hash = ?`,
      )
      .get(ticketHash(raw)) as
    | {
        id: number;
        channel: "sms" | "email";
        phone_norm: string | null;
        email: string | null;
        email_norm: string | null;
        expires_at: string;
        consumed_at: string | null;
      }
    | undefined;
  if (!row || row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.channel === "email" && row.email && row.email_norm) {
    return { id: row.id, channel: "email", email: row.email, emailNorm: row.email_norm };
  }
  if (row.channel === "sms" && row.phone_norm) {
    return { id: row.id, channel: "sms", phoneNorm: row.phone_norm };
  }
  return null;
}

/**
 * Hands a verified phone to `userId`: any unverified claim on the same number
 * (old password sign-ups that never proved it) is cleared. Caller holds a
 * transaction and has checked there is no verified holder.
 */
async function takePhone(db: Db, userId: number, phoneNorm: string, now: string) {
  await db.prepare(
        `UPDATE users SET phone = NULL, phone_norm = NULL, updated_at = ?
     WHERE phone_norm = ? AND phone_verified_at IS NULL AND id != ?`,
      ).run(now, phoneNorm, userId);
}

/** Same for an e-mail proven by a code: unconfirmed claims on it are cleared. */
async function takeEmail(db: Db, emailNorm: string, now: string) {
  await db.prepare(
        `UPDATE users SET email = NULL, email_norm = NULL, updated_at = ?
     WHERE email_norm = ? AND email_verified_at IS NULL`,
      ).run(now, emailNorm);
}

export type SignupInput = {
  ticketRaw: string | null | undefined;
  /** HMAC of the browser's device cookie; see device-limit.ts. */
  deviceHash: string;
  username: string;
  displayName?: string | null;
  city?: string | null;
  teamId: string;
  /** Text versions the member ticked on the sign-up form. */
  legal: { termsVersion: string; privacyVersion: string };
  /** Never shown publicly; only admins with PII rights see them. */
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD. */
  birthDate: string;
  /** Required for e-mail sign-ups (stored unverified); SMS sign-ups use the verified number. */
  phone?: string | null;
  /** Separate, optional consent to campaign SMS. Never a condition of sign-up. */
  marketingConsent?: boolean;
  /** Lets the member sign in with e-mail + password; codes stay as the fallback. */
  password: string;
};

export const MIN_SIGNUP_AGE = 13;

export const PASSWORD_RULE_ERROR =
  "Şifre en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermeli.";

const NAME_RE = /^[\p{L}][\p{L}' .-]{0,39}$/u;

/** Trimmed real-name part, or null when it is not a plausible name. */
export function cleanRealName(raw: string | null | undefined) {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  return v.length >= 2 && NAME_RE.test(v) ? v : null;
}

/** Age in whole years on `today`, or null for an invalid or future date. */
export function ageFromBirthDate(raw: string, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || date.getTime() > today.getTime()) return null;
  let age = today.getUTCFullYear() - y;
  const md = (today.getUTCMonth() + 1) * 100 + today.getUTCDate();
  if (md < mo * 100 + d) age -= 1;
  return age;
}

/**
 * Why a new member may not take `usernameNorm`, or null when the format is
 * fine and the name is not held back. Whether it is taken is checked apart.
 */
export async function usernameProblem(db: Db, usernameNorm: string) {
  if (!isUsername(usernameNorm)) {
    return {
      status: 400,
      error: "Kullanıcı adı 3–20 karakter olmalı; yalnızca küçük harf, rakam ve alt çizgi.",
    };
  }
  if (usernameNorm.startsWith("silinmis_") || isReservedName(usernameNorm)) {
    return { status: 400, error: "Bu kullanıcı adı kullanılamaz." };
  }
  if (await isUsernameReserved(db, usernameNorm)) {
    return { status: 409, error: "Bu kullanıcı adı ayrılmış, başka bir ad seç." };
  }
  return null;
}

export type SignupResult =
  | { ok: true; userId: number }
  | { ok: false; status: number; error: string };

/**
 * Creates the account and its permanent team vote in one transaction, so a
 * failed vote never leaves a half-registered account behind.
 */
export async function signupWithTicket(db: Db, input: SignupInput): Promise<SignupResult> {
  const usernameNorm = normalizeUsername(input.username);
  const usernameError = await usernameProblem(db, usernameNorm);
  if (usernameError) return { ok: false, ...usernameError };
  const displayName = (input.displayName ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (displayName && /[<>]/.test(displayName)) {
    return { ok: false, status: 400, error: "Görünen ad < veya > içeremez." };
  }
  if (displayName && isReservedName(displayName)) {
    return { ok: false, status: 400, error: "Bu görünen ad kullanılamaz." };
  }
  const city = input.city?.trim() || null;
  if (!city) {
    return { ok: false, status: 400, error: "Yaşadığın ili seç." };
  }
  if (!isProvince(city)) {
    return { ok: false, status: 400, error: "İl geçersiz." };
  }
  const firstName = cleanRealName(input.firstName);
  const lastName = cleanRealName(input.lastName);
  if (!firstName || !lastName) {
    return { ok: false, status: 400, error: "Adını ve soyadını harflerle yaz." };
  }
  const age = ageFromBirthDate(input.birthDate);
  if (age === null || age > 120) {
    return { ok: false, status: 400, error: "Doğum tarihi geçersiz." };
  }
  if (age < MIN_SIGNUP_AGE) {
    return { ok: false, status: 400, error: `${MIN_SIGNUP_AGE} yaşından küçükler üye olamaz.` };
  }
  const typedPhone = input.phone ? normalizePhone(input.phone) : null;
  if (typedPhone && !isTrMobile(typedPhone)) {
    return { ok: false, status: 400, error: "Cep telefonunu 5XX XXX XX XX biçiminde yaz." };
  }
  if (!isStrongPassword(input.password ?? "")) {
    return { ok: false, status: 400, error: PASSWORD_RULE_ERROR };
  }
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (): Promise<SignupResult> => {
          const ticket = await lookupSignupTicket(db, input.ticketRaw);
          if (!ticket) {
            return { ok: false, status: 401, error: TICKET_EXPIRED_ERROR };
          }
          if (ticket.channel === "email") {
            if (!typedPhone) {
              return { ok: false, status: 400, error: "Cep telefonu numaranı yaz." };
            }
            if (await db.prepare(`SELECT 1 FROM users WHERE phone_norm = ?`).get(typedPhone)) {
              return { ok: false, status: 409, error: "Bu telefon numarası başka bir hesapta kayıtlı." };
            }
          }
          if (ticket.channel === "sms") {
            if (await findVerifiedUserByPhone(db, ticket.phoneNorm)) {
              return { ok: false, status: 409, error: "Bu telefonla zaten bir hesap var. Giriş yap." };
            }
            if (await phoneHoldActive(db, ticket.phoneNorm)) {
              return { ok: false, status: 409, error: PHONE_HOLD_ERROR };
            }
          } else {
            if (await findVerifiedUserByEmail(db, ticket.emailNorm)) {
              return { ok: false, status: 409, error: "Bu e-postayla zaten bir hesap var. Giriş yap." };
            }
            if (await emailHoldActive(db, ticket.emailNorm)) {
              return { ok: false, status: 409, error: EMAIL_HOLD_ERROR };
            }
          }
          if (await deviceLimitReached(db, input.deviceHash)) {
            return { ok: false, status: 429, error: DEVICE_LIMIT_ERROR };
          }
          if (
            await db.prepare(`SELECT 1 FROM users WHERE username_norm = ?`).get(usernameNorm)
          ) {
            return { ok: false, status: 409, error: "Bu kullanıcı adı alınmış." };
          }

          const now = new Date().toISOString();
          const used = await db
                  .prepare(`UPDATE signup_tickets SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`)
                  .run(now, ticket.id);
          if (used.changes !== 1) {
            return { ok: false, status: 401, error: TICKET_EXPIRED_ERROR };
          }

          if (ticket.channel === "sms") await takePhone(db, -1, ticket.phoneNorm, now);
          else await takeEmail(db, ticket.emailNorm, now);
          // E-mail sign-ups type a phone that is not verified; an SMS check later can confirm it.
          const phoneNorm = ticket.channel === "sms" ? ticket.phoneNorm : typedPhone!;
          const info = await db
                  .prepare(
                    `INSERT INTO users
           (username, username_norm, display_name, status, role, created_at, updated_at,
            phone, phone_norm, phone_verified_at, email, email_norm, email_verified_at,
            first_name, last_name, birth_date, marketing_consent_at,
            city, terms_version, terms_accepted_at, password_hash)
           VALUES (?, ?, ?, 'active', 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  )
                  .run(
                    usernameNorm,
                    usernameNorm,
                    displayName || usernameNorm,
                    now,
                    now,
                    `+90${phoneNorm}`,
                    phoneNorm,
                    ticket.channel === "sms" ? now : null,
                    ticket.channel === "email" ? ticket.email : null,
                    ticket.channel === "email" ? ticket.emailNorm : null,
                    ticket.channel === "email" ? now : null,
                    firstName,
                    lastName,
                    input.birthDate,
                    input.marketingConsent ? now : null,
                    city,
                    TERMS_VERSION,
                    now,
                    passwordHash,
                  );
          await noteDeviceSignup(db, input.deviceHash, now);
          const userId = Number(info.lastInsertRowid);
          const legal = await recordLegalAcceptance(db, {
                  userId,
                  source: "signup",
                  at: now,
                  accepted: [
                    { doc: "terms", version: input.legal.termsVersion },
                    { doc: "privacy", version: input.legal.privacyVersion },
                  ],
                });
          if (!legal.ok) throw new SignupAbort(409, legal.error);
          const vote = await castFanVote(db, { userId, teamId: input.teamId, city });
          if (!vote.ok) throw new SignupAbort(vote.status, vote.error);
          await writeAudit(db, {
                    actorUserId: userId,
                    action: "account_signup",
                    targetType: "user",
                    targetId: userId,
                  });
          return { ok: true, userId };
        })();
  } catch (err) {
    if (err instanceof SignupAbort) return { ok: false, status: err.status, error: err.message };
    if (isConstraintViolation(err)) {
      return { ok: false, status: 409, error: "Bu kullanıcı adı, telefon veya e-posta zaten kayıtlı." };
    }
    return { ok: false, status: 500, error: "Kayıt tamamlanamadı. Biraz sonra dene." };
  }
}

const TICKET_EXPIRED_ERROR = "Doğrulamanın süresi doldu. Kodu yeniden iste.";

class SignupAbort extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Existing (password) account proves a phone by SMS and keeps it. */
export async function bindVerifiedPhone(
  db: Db,
  userId: number,
  phoneNorm: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return db.transaction(async () => {
    const holder = await findVerifiedUserByPhone(db, phoneNorm);
    if (holder && holder.id !== userId) {
      return { ok: false as const, status: 409, error: "Bu telefon başka bir hesapta doğrulanmış." };
    }
    if (await phoneHoldActive(db, phoneNorm)) {
      return { ok: false as const, status: 409, error: PHONE_HOLD_ERROR };
    }
    const user = await db
          .prepare(`SELECT phone_verified_at, deleted_at FROM users WHERE id = ?`)
          .get(userId) as { phone_verified_at: string | null; deleted_at: string | null } | undefined;
    if (!user || user.deleted_at) {
      return { ok: false as const, status: 404, error: "Hesap bulunamadı." };
    }
    if (user.phone_verified_at && await findFanVote(db, userId)) {
      // Swapping the verified phone of an account that already voted would let
      // one number vouch for many votes over time.
      return {
        ok: false as const,
        status: 409,
        error: "Oy vermiş bir hesabın doğrulanmış telefonu değiştirilemez.",
      };
    }
    const now = new Date().toISOString();
    await takePhone(db, userId, phoneNorm, now);
    await db.prepare(
            `UPDATE users SET phone = ?, phone_norm = ?, phone_verified_at = ?, updated_at = ? WHERE id = ?`,
          ).run(`+90${phoneNorm}`, phoneNorm, now, now, userId);
    await writeAudit(db, {
            actorUserId: userId,
            action: "phone_bound",
            targetType: "user",
            targetId: userId,
          });
    return { ok: true as const };
  })();
}

/**
 * Re-registration hold for a deleted account's phone or e-mail HMAC. A longer
 * hold already on the key is never shortened.
 */
async function holdIdentity(db: Db, hash: string, user: UserRow, voted: boolean, now: Date) {
  const banned = isUserBanned(user);
  const releaseAt = banned
    ? PHONE_HOLD_PERMANENT_UNTIL
    : new Date(now.getTime() + (voted ? PHONE_HOLD_VOTED_MS : PHONE_HOLD_MS)).toISOString();
  const reason = banned ? "account_deleted_banned" : voted ? "account_deleted_voted" : "account_deleted";
  await db.prepare(
        `INSERT INTO phone_holds (phone_hash, reason, release_at, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(phone_hash) DO UPDATE SET
       release_at = GREATEST(phone_holds.release_at, excluded.release_at),
       reason = CASE WHEN excluded.release_at > phone_holds.release_at THEN excluded.reason ELSE phone_holds.reason END`,
      ).run(hash, reason, releaseAt, now.toISOString());
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
export async function deleteAccount(
  db: Db,
  input: { userId: number; actorUserId: number | null; reason: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  return db.transaction(async () => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(input.userId) as
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
    const vote = await findFanVote(db, user.id);
    if (vote && vote.status === "active") {
      await voidFanVote(db, {
                userId: user.id,
                reason: "account_deleted",
                actorUserId: input.actorUserId,
                action: "fan_vote_void_account_deleted",
              });
    }
    if (user.phone_norm && user.phone_verified_at) {
      await holdIdentity(db, identityPhoneHash(user.phone_norm), user, Boolean(vote), now);
    }
    if (user.email_norm && user.email_verified_at) {
      await holdIdentity(db, identityEmailHash(user.email_norm), user, Boolean(vote), now);
    }
    const anon = `silinmis_${user.id}`;
    await db.prepare(
            `UPDATE users SET
         username = ?, username_norm = ?, display_name = 'Silinmiş üye',
         email = NULL, email_norm = NULL, password_hash = NULL,
         first_name = NULL, last_name = NULL, birth_date = NULL, marketing_consent_at = NULL,
         phone = NULL, phone_norm = NULL, city = NULL,
         bio = NULL, avatar = NULL, show_city = 0, profile_visibility = 'members',
         totp_enabled = 0, totp_secret_enc = NULL,
         status = 'deleted', deleted_at = ?, updated_at = ?
       WHERE id = ?`,
          ).run(anon, anon, nowIso, nowIso, user.id);
    await db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
            nowIso,
            user.id,
          );
    await db.prepare(`DELETE FROM auth_otps WHERE user_id = ?`).run(user.id);
    await db.prepare(`DELETE FROM user_badges WHERE user_id = ?`).run(user.id);
    await db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);
    await db.prepare(`DELETE FROM user_email_tokens WHERE user_id = ?`).run(user.id);
    await db.prepare(`DELETE FROM admin_recovery_codes WHERE user_id = ?`).run(user.id);
    await db.prepare(`DELETE FROM admin_totp_setup WHERE user_id = ?`).run(user.id);
    await writeAudit(db, {
            actorUserId: input.actorUserId,
            action: "account_deleted",
            targetType: "user",
            targetId: user.id,
            reason: input.reason,
          });
    return { ok: true as const };
  })();
}
