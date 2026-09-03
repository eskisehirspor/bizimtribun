/** ISO `YYYY-MM-DD`. Valid calendar day, not in the future, year >= 1900. No age gate. */
export function parseIsoBirthDate(raw: string) {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  if (y < 1900) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (dt.getTime() > today) return null;
  return s;
}

/** Full years of age at `at`. Ready for a future majority check; unused as a gate now. */
export function ageInFullYears(isoDate: string, at = new Date()) {
  const parsed = parseIsoBirthDate(isoDate);
  if (!parsed) return null;
  const y = Number(parsed.slice(0, 4));
  const m = Number(parsed.slice(5, 7));
  const d = Number(parsed.slice(8, 10));
  let age = at.getFullYear() - y;
  const month = at.getMonth() + 1;
  const day = at.getDate();
  if (month < m || (month === m && day < d)) age -= 1;
  return age;
}
