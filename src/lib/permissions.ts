/**
 * Server-side permission table. The client may hide buttons with `can()`,
 * but every admin API route checks the same table through the DB user row.
 */
export const PERMISSIONS = [
  "admin.access",
  "forum.moderate",
  "moderation.view",
  "users.view",
  "users.ban",
  "users.ban_staff",
  "users.pii",
  "roles.manage",
  "votes.void",
  "votes.restore",
  "teams.manage",
  "team_requests.manage",
  "usernames.manage",
  "dashboard.view",
  "audit.view",
  "content.manage",
  "settings.manage",
  "security.self",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = "moderator" | "admin" | "super_admin";

const MODERATOR: Permission[] = [
  "admin.access",
  "forum.moderate",
  "moderation.view",
  "users.view",
  "users.ban",
  "security.self",
];

const ADMIN: Permission[] = [
  ...MODERATOR,
  "users.ban_staff",
  "users.pii",
  "votes.void",
  "teams.manage",
  "team_requests.manage",
  "usernames.manage",
  "dashboard.view",
  "audit.view",
  "content.manage",
];

const SUPER_ADMIN: Permission[] = [...ADMIN, "roles.manage", "settings.manage", "votes.restore"];

const TABLE: Record<string, ReadonlySet<Permission>> = {
  moderator: new Set(MODERATOR),
  admin: new Set(ADMIN),
  super_admin: new Set(SUPER_ADMIN),
};

const RANK: Record<string, number> = { user: 0, moderator: 1, admin: 2, super_admin: 3 };

export function roleRank(role: string | null | undefined) {
  return RANK[role ?? ""] ?? 0;
}

export function can(role: string | null | undefined, permission: Permission) {
  return TABLE[role ?? ""]?.has(permission) ?? false;
}

export function permissionsFor(role: string | null | undefined): Permission[] {
  return [...(TABLE[role ?? ""] ?? [])];
}

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return roleRank(role) > 0;
}

export const ROLE_LABELS: Record<string, string> = {
  user: "Üye",
  moderator: "Moderatör",
  admin: "Admin",
  super_admin: "Süper Admin",
};

/**
 * May `actorRole` ban an account holding `targetRole`? Admins and super
 * admins are never bannable from the panel; moderators only by admins.
 */
export function canBanRole(actorRole: string, targetRole: string) {
  if (roleRank(targetRole) >= 2) return false;
  if (targetRole === "moderator") return can(actorRole, "users.ban_staff");
  return can(actorRole, "users.ban");
}
