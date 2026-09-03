import { getDb } from "./db";
import { normalizeEmail } from "./crypto";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Development-only: promote a matching existing user to admin.
 * Ignored in production even if env vars are set. No public endpoint.
 */
export function applyDevAdminBootstrap() {
  if (isProduction()) return;

  const usernameRaw = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const emailRaw = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  if (!usernameRaw && !emailRaw) return;

  const db = getDb();
  const now = new Date().toISOString();

  if (usernameRaw) {
    const usernameNorm = usernameRaw.toLowerCase();
    db.prepare(
      `UPDATE users
       SET role = 'admin', updated_at = ?
       WHERE username_norm = ? AND role != 'admin'`,
    ).run(now, usernameNorm);
  }

  if (emailRaw) {
    const emailNorm = normalizeEmail(emailRaw);
    db.prepare(
      `UPDATE users
       SET role = 'admin', updated_at = ?
       WHERE email_norm = ? AND role != 'admin'`,
    ).run(now, emailNorm);
  }
}
