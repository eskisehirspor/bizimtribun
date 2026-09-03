export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export function isTrMobile(digits: string) {
  return /^5\d{9}$/.test(digits);
}

/** Mask as `5XX XXX XX XX` while typing. */
export function formatTrMobileInput(raw: string) {
  const d = normalizePhone(raw).slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(
    (p) => p.length > 0,
  );
  return parts.join(" ");
}
