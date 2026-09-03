import { getDb } from "./db";
import { hmac } from "./crypto";
import { recordModerationAction } from "./moderation";
import { registerAttemptCount } from "./stats";
import { revokeUserSessionsOn } from "./admin-2fa";
import {
  AUTH_LOGIN_PER_HOUR,
  AUTH_LOGIN_PER_ID_HOUR,
  AUTH_REGISTER_PER_HOUR,
} from "./policy";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type UserRow = {
  id: number;
  username: string;
  username_norm: string;
  display_name: string;
  email: string;
  email_norm: string;
  password_hash: string;
  team_id: string | null;
  status: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  banned_at: string | null;
  ban_reason: string | null;
  ban_expires_at: string | null;
  participant_id: number | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  phone: string | null;
  phone_norm: string | null;
  city: string | null;
  totp_enabled: number;
  totp_secret_enc: string | null;
  email_verified_at: string | null;
};

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  teamId: string | null;
  role: UserRole;
  status: string;
  emailVerified: boolean;
};

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function isUsername(value: string) {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

export function isBanExpired(
  row: Pick<UserRow, "ban_expires_at">,
  nowMs = Date.now(),
) {
  return Boolean(
    row.ban_expires_at &&
      new Date(row.ban_expires_at).getTime() <= nowMs,
  );
}

/** Server-side ban gate: permanent bans, future expiry, and stale rows after expiry. */
export function isUserBanned(
  row: Pick<UserRow, "status" | "banned_at" | "ban_expires_at">,
  nowMs = Date.now(),
) {
  const flagged = row.status === "banned" || Boolean(row.banned_at);
  if (!flagged) return false;
  if (isBanExpired(row, nowMs)) return false;
  return true;
}

export function effectiveUserStatus(
  row: Pick<UserRow, "status" | "banned_at" | "ban_expires_at">,
  nowMs = Date.now(),
) {
  if (isUserBanned(row, nowMs)) return "banned";
  if (row.status === "banned" || row.banned_at) return "active";
  return row.status;
}

/** Clear expired ban metadata once; no-op when already active or ban still valid. */
export function reconcileExpiredBan(user: UserRow, nowMs = Date.now()): UserRow {
  if (!isBanExpired(user, nowMs)) return user;
  if (user.status !== "banned" && !user.banned_at) return user;

  const now = new Date(nowMs).toISOString();
  const updated = getDb()
    .prepare(
      `UPDATE users
       SET status = 'active', banned_at = NULL, ban_reason = NULL, ban_expires_at = NULL, updated_at = ?
       WHERE id = ?
         AND ban_expires_at IS NOT NULL
         AND ban_expires_at <= ?`,
    )
    .run(now, user.id, now);

  if (updated.changes === 1) {
    return {
      ...user,
      status: "active",
      banned_at: null,
      ban_reason: null,
      ban_expires_at: null,
      updated_at: now,
    };
  }

  return findUserById(user.id) ?? user;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    teamId: row.team_id,
    role: row.role === "admin" ? "admin" : "user",
    status: effectiveUserStatus(row),
    emailVerified: Boolean(row.email_verified_at),
  };
}

export function isAdmin(user: Pick<UserRow, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}

export function findUserById(id: number) {
  return getDb()
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
}

export function findUserByEmailNorm(emailNorm: string) {
  return getDb()
    .prepare(`SELECT * FROM users WHERE email_norm = ?`)
    .get(emailNorm) as UserRow | undefined;
}

export function findUserByPhoneNorm(phoneNorm: string) {
  if (!phoneNorm) return undefined;
  return getDb()
    .prepare(`SELECT * FROM users WHERE phone_norm = ?`)
    .get(phoneNorm) as UserRow | undefined;
}

export function findUserByUsernameNorm(usernameNorm: string) {
  return getDb()
    .prepare(`SELECT * FROM users WHERE username_norm = ?`)
    .get(usernameNorm) as UserRow | undefined;
}

export function findUserByLogin(login: string) {
  if (login.includes("@")) return findUserByEmailNorm(login);
  return findUserByUsernameNorm(normalizeUsername(login));
}

export function noteAuthAttempt(ipHash: string) {
  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());
}

export function authRegisterLimited(ipHash: string) {
  return registerAttemptCount(ipHash) >= AUTH_REGISTER_PER_HOUR;
}

export function authLoginLimited(ipHash: string, loginKey: string) {
  const idHash = hmac(`auth-id:${loginKey}`);
  return (
    registerAttemptCount(ipHash) >= AUTH_LOGIN_PER_HOUR ||
    registerAttemptCount(idHash) >= AUTH_LOGIN_PER_ID_HOUR
  );
}

export function noteLoginAttempts(ipHash: string, loginKey: string) {
  noteAuthAttempt(ipHash);
  noteAuthAttempt(hmac(`auth-id:${loginKey}`));
}

export function banUser(
  userId: number,
  reason: string,
  expiresAt: string | null = null,
  moderatorUserId?: number,
): { ok: true } | { ok: false; error: string } {
  const target = findUserById(userId);
  if (!target) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (isAdmin(target)) {
    return { ok: false, error: "Admin hesap banlanamaz." };
  }

  const now = new Date().toISOString();
  const updated = getDb()
    .prepare(
      `UPDATE users
       SET status = 'banned', banned_at = ?, ban_reason = ?, ban_expires_at = ?, updated_at = ?
       WHERE id = ? AND role != 'admin'`,
    )
    .run(now, reason.slice(0, 200), expiresAt, now, userId);

  if (updated.changes !== 1) {
    return { ok: false, error: "Admin hesap banlanamaz." };
  }

  getDb()
    .prepare(
      `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    )
    .run(now, userId);

  if (moderatorUserId) {
    recordModerationAction({
      moderatorUserId,
      targetUserId: userId,
      action: "ban_user",
      reason,
    });
  }

  return { ok: true };
}

export function unbanUser(
  userId: number,
  reason: string,
  moderatorUserId: number,
): { ok: true } | { ok: false; error: string } {
  const target = findUserById(userId);
  if (!target) return { ok: false, error: "Kullanıcı bulunamadı." };
  const flagged = target.status === "banned" || Boolean(target.banned_at);
  if (!flagged) return { ok: false, error: "Bu hesapta ban yok." };

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE users
       SET status = 'active', banned_at = NULL, ban_reason = NULL, ban_expires_at = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .run(now, userId);

  recordModerationAction({
    moderatorUserId,
    targetUserId: userId,
    action: "unban_user",
    reason,
  });
  return { ok: true };
}

export function countAdmins() {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'admin'`)
      .get() as { c: number }
  ).c;
}

export function setUserRole(
  targetId: number,
  role: UserRole,
  moderator: UserRow,
  reason: string,
): { ok: true } | { ok: false; error: string } {
  const target = findUserById(targetId);
  if (!target) return { ok: false, error: "Kullanıcı bulunamadı." };
  const next = role === "admin" ? "admin" : "user";
  if (target.role === next) return { ok: true };

  if (next === "user" && isAdmin(target)) {
    if (target.id !== moderator.id) {
      return { ok: false, error: "Başka bir adminin rolü düşürülemez." };
    }
    if (countAdmins() <= 1) {
      return { ok: false, error: "Son admin hesabının rolü düşürülemez." };
    }
  }

  const now = new Date().toISOString();
  const updated = getDb()
    .prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`)
    .run(next, now, targetId);
  if (updated.changes !== 1) {
    return { ok: false, error: "Rol güncellenemedi." };
  }

  recordModerationAction({
    moderatorUserId: moderator.id,
    targetUserId: targetId,
    action: next === "admin" ? "promote_admin" : "demote_admin",
    reason,
  });
  revokeUserSessionsOn(getDb(), targetId);
  return { ok: true };
}
