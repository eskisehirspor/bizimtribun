import { getSessionUser } from "./auth";
import { evaluateAdminGate } from "./admin-gate";
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
export async function requireAdmin(req?: Request): Promise<AdminGate> {
  const user = await getSessionUser(req);
  return evaluateAdminGate(user);
}
