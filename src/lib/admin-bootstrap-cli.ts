import type Database from "better-sqlite3";
import { writeAudit } from "./audit";

/**
 * First super admin, from a shell on the server only (no HTTP route).
 * The target must be an existing, phone-verified, non-deleted account that
 * signed up normally. Refuses when a super admin already exists, so it
 * cannot be used later to quietly mint more of them.
 */
export function bootstrapSuperAdmin(
  db: Database.Database,
  usernameRaw: string,
): { ok: true; userId: number } | { ok: false; error: string } {
  return promoteFirstSuperAdmin(db, "username_norm", usernameRaw.trim().toLowerCase(), "server CLI");
}

/**
 * First super admin from `SUPER_ADMIN_EMAIL` (server env, so setting it already
 * needs server access). Same rules as the CLI, and the account must have proven
 * that inbox with an e-mail code. Once any super admin exists this does nothing.
 */
export function bootstrapSuperAdminByEmail(
  db: Database.Database,
  emailNorm: string,
): { ok: true; userId: number } | { ok: false; error: string } {
  return promoteFirstSuperAdmin(db, "email_norm", emailNorm, "SUPER_ADMIN_EMAIL", true);
}

function promoteFirstSuperAdmin(
  db: Database.Database,
  column: "username_norm" | "email_norm",
  value: string,
  reason: string,
  requireEmailVerified = false,
): { ok: true; userId: number } | { ok: false; error: string } {
  return db.transaction(() => {
    const existing = db
      .prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'super_admin' AND deleted_at IS NULL`)
      .get() as { c: number };
    if (existing.c > 0) {
      return { ok: false as const, error: "A super admin already exists; promote from the admin panel." };
    }
    const user = db
      .prepare(
        `SELECT id, phone_verified_at, email_verified_at, deleted_at, status FROM users WHERE ${column} = ?`,
      )
      .get(value) as
      | {
          id: number;
          phone_verified_at: string | null;
          email_verified_at: string | null;
          deleted_at: string | null;
          status: string;
        }
      | undefined;
    if (!user || user.deleted_at) return { ok: false as const, error: "No such account." };
    if (requireEmailVerified ? !user.email_verified_at : !user.phone_verified_at && !user.email_verified_at) {
      return { ok: false as const, error: "Account must verify its phone or e-mail first." };
    }
    if (user.status !== "active") return { ok: false as const, error: "Account is not active." };
    const now = new Date().toISOString();
    db.prepare(`UPDATE users SET role = 'super_admin', updated_at = ? WHERE id = ?`).run(now, user.id);
    db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(
      now,
      user.id,
    );
    writeAudit(db, {
      actorUserId: null,
      action: "super_admin_bootstrap",
      targetType: "user",
      targetId: user.id,
      reason,
    });
    return { ok: true as const, userId: user.id };
  })();
}
