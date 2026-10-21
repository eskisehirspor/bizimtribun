import type Database from "better-sqlite3";
import { writeAudit } from "./audit";
import { isProvince } from "./provinces";

/**
 * The census. Each account holds at most one vote (UNIQUE user_id), a vote's
 * team/city never change (trigger), votes are never deleted (trigger), and a
 * vote can only leave the count by being voided once with a reason.
 *
 * "Doğrulanmış taraftar" = number of fan_votes rows with status 'active'.
 * Every such row belongs to an account whose phone was verified by SMS when
 * the vote was cast (insert trigger) and that has not been deleted
 * (deletion voids the vote in the same transaction).
 */
export type FanVote = {
  id: number;
  user_id: number;
  team_id: string;
  city: string | null;
  cast_at: string;
  status: "active" | "void";
  voided_at: string | null;
  void_reason: string | null;
};

export function findFanVote(db: Database.Database, userId: number) {
  return db
    .prepare(`SELECT * FROM fan_votes WHERE user_id = ?`)
    .get(userId) as FanVote | undefined;
}

export type CastFanVoteResult =
  | { ok: true; already: boolean; vote: FanVote }
  | { ok: false; status: number; error: string; code: string };

function sqliteCode(err: unknown) {
  return err && typeof err === "object" && "code" in err
    ? String((err as { code: unknown }).code)
    : "";
}

function errMessage(err: unknown) {
  return err instanceof Error ? err.message : "";
}

/**
 * Casts the account's one permanent vote. Idempotent for the same team;
 * any other team is refused once a vote exists. Must run server side with
 * the session user's id, never an id from the request body.
 */
export function castFanVote(
  db: Database.Database,
  input: { userId: number; teamId: string; city: string | null },
): CastFanVoteResult {
  const city = input.city?.trim() || null;
  if (city && !isProvince(city)) {
    return { ok: false, status: 400, error: "İl geçersiz.", code: "BAD_CITY" };
  }
  const run = db.transaction((): CastFanVoteResult => {
    const user = db
      .prepare(
        `SELECT id, phone_verified_at, deleted_at, status, banned_at, ban_expires_at
         FROM users WHERE id = ?`,
      )
      .get(input.userId) as
      | {
          id: number;
          phone_verified_at: string | null;
          deleted_at: string | null;
          status: string;
          banned_at: string | null;
          ban_expires_at: string | null;
        }
      | undefined;
    if (!user || user.deleted_at) {
      return { ok: false, status: 404, error: "Hesap bulunamadı.", code: "NO_USER" };
    }
    if (!user.phone_verified_at) {
      return {
        ok: false,
        status: 403,
        error: "Oy vermek için telefonunu SMS ile doğrulaman gerekiyor.",
        code: "PHONE_UNVERIFIED",
      };
    }
    const banned =
      (user.status === "banned" || user.banned_at) &&
      !(user.ban_expires_at && new Date(user.ban_expires_at).getTime() <= Date.now());
    if (banned) {
      return { ok: false, status: 403, error: "Hesap askıya alınmış.", code: "BANNED" };
    }

    const existing = findFanVote(db, input.userId);
    if (existing) {
      if (existing.team_id === input.teamId && existing.status === "active") {
        return { ok: true, already: true, vote: existing };
      }
      return {
        ok: false,
        status: 409,
        error: "Takım seçimin kesinleşti ve değiştirilemez.",
        code: "TEAM_LOCKED",
      };
    }

    const team = db
      .prepare(`SELECT id, is_active FROM teams WHERE id = ?`)
      .get(input.teamId) as { id: string; is_active: number } | undefined;
    if (!team || !team.is_active) {
      return { ok: false, status: 400, error: "Bu takım seçilemez.", code: "BAD_TEAM" };
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET team_id = ?, city = COALESCE(city, ?), updated_at = ? WHERE id = ?`,
    ).run(input.teamId, city, now, input.userId);
    db.prepare(
      `INSERT INTO fan_votes (user_id, team_id, city, cast_at) VALUES (?, ?, ?, ?)`,
    ).run(input.userId, input.teamId, city, now);
    return { ok: true, already: false, vote: findFanVote(db, input.userId)! };
  });

  try {
    return run();
  } catch (err) {
    const existing = findFanVote(db, input.userId);
    if (sqliteCode(err).includes("CONSTRAINT") && existing) {
      if (existing.team_id === input.teamId && existing.status === "active") {
        return { ok: true, already: true, vote: existing };
      }
      return {
        ok: false,
        status: 409,
        error: "Takım seçimin kesinleşti ve değiştirilemez.",
        code: "TEAM_LOCKED",
      };
    }
    const msg = errMessage(err);
    if (msg.includes("VOTE_TEAM_INACTIVE")) {
      return { ok: false, status: 400, error: "Bu takım seçilemez.", code: "BAD_TEAM" };
    }
    if (msg.includes("VOTE_USER_NOT_ELIGIBLE")) {
      return {
        ok: false,
        status: 403,
        error: "Oy vermek için telefonunu SMS ile doğrulaman gerekiyor.",
        code: "PHONE_UNVERIFIED",
      };
    }
    return { ok: false, status: 500, error: "Oy kaydedilemedi. Biraz sonra dene.", code: "ERROR" };
  }
}

/**
 * Data correction only: removes a vote from the count with a recorded reason.
 * It never moves a vote to another team, and a voided vote stays voided.
 * Callers must be in the same transaction as their own audit needs, or rely
 * on the audit entry written here.
 */
export function voidFanVote(
  db: Database.Database,
  input: { userId: number; reason: string; actorUserId: number | null; action?: string },
): { ok: true } | { ok: false; error: string } {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Gerekçe gerekli." };
  const now = new Date().toISOString();
  const hit = db
    .prepare(
      `UPDATE fan_votes SET status = 'void', voided_at = ?, void_reason = ?, voided_by_user_id = ?
       WHERE user_id = ? AND status = 'active'`,
    )
    .run(now, reason.slice(0, 300), input.actorUserId, input.userId);
  if (hit.changes !== 1) return { ok: false, error: "Geçerli oy yok." };
  writeAudit(db, {
    actorUserId: input.actorUserId,
    action: input.action ?? "fan_vote_void",
    targetType: "user",
    targetId: input.userId,
    reason,
  });
  return { ok: true };
}

/**
 * Undoes a void (super admins only, checked by the route). The same vote row
 * becomes active again with its original team, province and cast time; the
 * void details are kept in fan_vote_restores and the audit log. A trigger
 * refuses the update without that record, and for deleted or unverified
 * accounts.
 */
export function restoreFanVote(
  db: Database.Database,
  input: { userId: number; reason: string; actorUserId: number },
): { ok: true } | { ok: false; error: string } {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, error: "Gerekçe gerekli." };
  const vote = findFanVote(db, input.userId);
  if (!vote || vote.status !== "void") return { ok: false, error: "Geri alınacak iptal edilmiş oy yok." };
  if (vote.void_reason === "account_deleted") {
    return { ok: false, error: "Silinen hesabın oyu geri alınamaz." };
  }
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO fan_vote_restores (vote_id, actor_user_id, reason, voided_at, void_reason, voided_by_user_id, created_at)
       SELECT id, ?, ?, voided_at, void_reason, voided_by_user_id, ? FROM fan_votes WHERE id = ?`,
    ).run(input.actorUserId, reason.slice(0, 300), now, vote.id);
    db.prepare(
      `UPDATE fan_votes SET status = 'active', voided_at = NULL, void_reason = NULL, voided_by_user_id = NULL,
         restored_at = ?
       WHERE id = ? AND status = 'void'`,
    ).run(now, vote.id);
  } catch (err) {
    if (errMessage(err).includes("VOTE_IMMUTABLE")) {
      return { ok: false, error: "Bu oy geri alınamaz (hesap silinmiş ya da telefonu doğrulanmamış)." };
    }
    throw err;
  }
  writeAudit(db, {
    actorUserId: input.actorUserId,
    action: "admin_fan_vote_restore",
    targetType: "user",
    targetId: input.userId,
    reason,
  });
  return { ok: true };
}
