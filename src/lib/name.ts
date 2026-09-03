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
