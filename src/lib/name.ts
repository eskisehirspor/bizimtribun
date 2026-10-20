const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿĞğÜüŞşİıÖöÇçÂâÎîÛû][A-Za-zÀ-ÖØ-öø-ÿĞğÜüŞşİıÖöÇçÂâÎîÛû'\- ]{0,38}$/;

export function cleanPersonName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isPersonName(value: string) {
  const v = cleanPersonName(value);
  if (v.length < 2 || v.length > 40) return false;
  if (/\d/.test(v)) return false;
  if (!NAME_RE.test(v)) return false;
  const letters = v.replace(/[^A-Za-zÀ-ÖØ-öø-ÿĞğÜüŞşİıÖöÇç]/g, "");
  return letters.length >= 2;
}

export function displayNameFromParts(first: string, last: string) {
  const full = `${cleanPersonName(first)} ${cleanPersonName(last)}`.trim();
  if (full.length <= 40) return full;
  return cleanPersonName(first).slice(0, 40);
}

/** Words a member's name must not contain, so nobody can pass as staff or the site. */
const RESERVED_NAME_PARTS = ["moderator", "moderatör", "admin", "yonetici", "yönetici", "yonetim", "yönetim", "bizimtribun", "bizimtribün", "destek", "resmi"];

/** True when a username or display name looks like the site or its staff. */
export function isReservedName(value: string) {
  const flat = value.toLocaleLowerCase("tr").replace(/[\s_.\-]+/g, "");
  return RESERVED_NAME_PARTS.some((part) => flat.includes(part));
}
