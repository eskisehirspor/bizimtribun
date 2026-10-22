import { getDb } from "./db";
import { normalizeEmail } from "./crypto";
import { bootstrapSuperAdminByEmail } from "./admin-bootstrap-cli";

/**
 * Production and development: when `SUPER_ADMIN_EMAIL` is set and no super admin
 * exists yet, the account with that verified e-mail becomes super admin as it
 * signs in. Runs before the new session is written, so the CLI's session revoke
 * never logs anyone out mid-request. 2FA is still forced by the admin panel.
 */
export async function applySuperAdminEmailBootstrap(userId: number) {
  const emailRaw = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (!emailRaw) return;
  const db = getDb();
  const row = await db.prepare(`SELECT email_norm FROM users WHERE id = ?`).get(userId) as
    | { email_norm: string }
    | undefined;
  if (!row || row.email_norm !== normalizeEmail(emailRaw)) return;
  await bootstrapSuperAdminByEmail(db, row.email_norm);
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Development-only: promote a matching existing user to admin.
 * Ignored in production even if env vars are set. No public endpoint.
 */
export async function applyDevAdminBootstrap() {
  if (isProduction()) return;

  const usernameRaw = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const emailRaw = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  if (!usernameRaw && !emailRaw) return;

  const db = getDb();
  const now = new Date().toISOString();

  if (usernameRaw) {
    const usernameNorm = usernameRaw.toLowerCase();
    await db.prepare(
            `UPDATE users
       SET role = 'admin', updated_at = ?
       WHERE username_norm = ? AND role NOT IN ('admin', 'super_admin')`,
          ).run(now, usernameNorm);
  }

  if (emailRaw) {
    const emailNorm = normalizeEmail(emailRaw);
    await db.prepare(
            `UPDATE users
       SET role = 'admin', updated_at = ?
       WHERE email_norm = ? AND role NOT IN ('admin', 'super_admin')`,
          ).run(now, emailNorm);
  }
}
