import { recordSecurityEvent } from "./admin-2fa";
import { getSessionUser } from "./auth";
import { getDb } from "./db";
import { evaluateAdminGate } from "./admin-gate";
import type { Permission } from "./permissions";
import { isAdmin, type UserRow } from "./users";

export { isAdmin };
export { applyDevAdminBootstrap } from "./admin-bootstrap";
export { recordModerationAction } from "./moderation";

export type AdminGate =
  | { ok: true; user: UserRow }
  | { ok: false; error: string; status: number };

/**
 * Session cookie → users row in DB. Role is never read from the token.
 * Call this in every admin API route; do not rely on the client.
 */
export async function requireAdmin(
  req?: Request,
  permission: Permission = "admin.access",
): Promise<AdminGate> {
  const user = await getSessionUser(req);
  const gate = evaluateAdminGate(user, permission);
  if (!gate.ok && user && gate.status === 403) {
    // Signed-in member reaching for a staff action: kept for the security page.
    recordSecurityEvent(getDb(), { userId: user.id, action: `admin_denied:${permission}`, success: false });
  }
  return gate;
}
