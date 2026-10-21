/** `5321234567` → `532 *** ** 67`. Used anywhere staff or users see a number. */
export function maskPhone(norm: string | null | undefined) {
  if (!norm) return null;
  const digits = norm.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return "***";
  return `${digits.slice(0, 3)} *** ** ${digits.slice(8)}`;
}

/** `ali.veli@ornek.com` → `a***@ornek.com`. */
export function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
