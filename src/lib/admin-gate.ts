import { isUserBanned } from "./users";

export type AdminGateUser = {
  role: string;
  status: string;
  banned_at: string | null;
  ban_expires_at: string | null;
};

export type AdminGateResult<T extends AdminGateUser = AdminGateUser> =
  | { ok: true; user: T }
  | { ok: false; error: string; status: number };

/** Session cookie → DB user. Role is never read from the token. */
export function evaluateAdminGate<T extends AdminGateUser>(
  user: T | null | undefined,
): AdminGateResult<T> {
  if (!user) {
    return { ok: false, error: "Giriş gerekli.", status: 401 };
  }
  if (user.role !== "admin") {
    return { ok: false, error: "Bu işlem için yetkin yok.", status: 403 };
  }
  if (isUserBanned(user)) {
    return { ok: false, error: "Hesap askıya alınmış.", status: 403 };
  }
  return { ok: true, user };
}
