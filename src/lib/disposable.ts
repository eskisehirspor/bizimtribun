const DISPOSABLE = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "throwaway.email",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "sharklasers.com",
  "grr.la",
  "dispostable.com",
  "fakeinbox.com",
  "moakt.com",
  "emailondeck.com",
  "mailnesia.com",
  "tempail.com",
  "minuteinbox.com",
  "dropmail.me",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return DISPOSABLE.has(domain);
}
