import { can, type Permission } from "./permissions";
import { isUserBanned } from "./users";

export type AdminGateUser = {
  role: string;
  status: string;
  banned_at: string | null;
  ban_expires_at: string | null;
  totp_enabled?: number | null;
};

export const ADMIN_2FA_REQUIRED_ERROR =
  "Yönetim paneli için iki adımlı doğrulama (2FA) zorunlu. Önce Yönetim > Güvenlik sayfasından 2FA'yı aç.";

export type AdminGateResult<T extends AdminGateUser = AdminGateUser> =
  | { ok: true; user: T }
  | { ok: false; error: string; status: number };

/** Session cookie → DB user. Role is never read from the token. */
export function evaluateAdminGate<T extends AdminGateUser>(
  user: T | null | undefined,
  permission: Permission = "admin.access",
): AdminGateResult<T> {
  if (!user) {
    return { ok: false, error: "Giriş gerekli.", status: 401 };
  }
  if (!can(user.role, permission)) {
    return { ok: false, error: "Bu işlem için yetkin yok.", status: 403 };
  }
  if (isUserBanned(user)) {
    return { ok: false, error: "Hesap askıya alınmış.", status: 403 };
  }
  // Staff must turn on TOTP before anything but their own security settings:
  // an SMS code alone (SIM swap, borrowed phone) must not open the panel.
  if (permission !== "security.self" && Number(user.totp_enabled) !== 1) {
    return { ok: false, error: ADMIN_2FA_REQUIRED_ERROR, status: 403 };
  }
  return { ok: true, user };
}
