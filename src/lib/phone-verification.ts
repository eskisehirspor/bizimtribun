/**
 * Launch-mode switch for census voting.
 * Server-side only. Unset / empty / anything except true|1|yes → disabled.
 * Production default is therefore false (email-only votes).
 * Set PHONE_VERIFICATION_ENABLED=true to require OTP again.
 */
export function parsePhoneVerificationEnabled(raw: string | undefined | null) {
  if (raw == null) return false;
  const value = raw.trim().toLowerCase();
  if (!value) return false;
  return value === "true" || value === "1" || value === "yes";
}

export function isPhoneVerificationEnabled() {
  return parsePhoneVerificationEnabled(process.env.PHONE_VERIFICATION_ENABLED);
}

export function participantMeetsVoteVerification(
  row: {
    verified_at: string | null;
    phone_verified_at: string | null;
  },
  requirePhone = isPhoneVerificationEnabled(),
) {
  if (!row.verified_at) return false;
  if (requirePhone && !row.phone_verified_at) return false;
  return true;
}

export function voteVerificationError(requirePhone = isPhoneVerificationEnabled()) {
  return requirePhone
    ? "E-posta ve telefon doğrulanmadan oy verilemez."
    : "E-posta doğrulanmadan oy verilemez.";
}
