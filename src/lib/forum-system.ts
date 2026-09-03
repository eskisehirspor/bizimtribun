/** Non-login seed/system accounts. Identified by credential marker, not username. */
export const FORUM_SYSTEM_PASSWORD_HASH = "disabled$no-login";
export const FORUM_SYSTEM_EMAIL_DOMAIN = "@bizimtribun.internal";
export const FORUM_SYSTEM_USERNAME = "tribun";
export const FORUM_SYSTEM_EMAIL = `tribun${FORUM_SYSTEM_EMAIL_DOMAIN}`;

export function isForumSystemAccount(row: {
  password_hash?: string | null;
  email_norm?: string | null;
}) {
  if (row.password_hash === FORUM_SYSTEM_PASSWORD_HASH) return true;
  const email = row.email_norm || "";
  return email.endsWith(FORUM_SYSTEM_EMAIL_DOMAIN);
}
