/** Password rules, shared by the server and the forms (no Node APIs here). */
const SPECIAL_RE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

export type PasswordChecks = {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  noEdgeSpace: boolean;
};

export const PASSWORD_RULE_LABELS: { key: keyof PasswordChecks; label: string }[] =
  [
    { key: "minLength", label: "En az 8 karakter" },
    { key: "upper", label: "En az 1 büyük harf" },
    { key: "lower", label: "En az 1 küçük harf" },
    { key: "digit", label: "En az 1 rakam" },
    { key: "special", label: "En az 1 özel karakter (!@#…)" },
    { key: "noEdgeSpace", label: "Başta veya sonda boşluk yok" },
  ];

export function passwordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8 && password.length <= 128,
    upper: /[A-ZİĞÜŞÖÇ]/.test(password),
    lower: /[a-zığiüşöç]/.test(password),
    digit: /\d/.test(password),
    special: SPECIAL_RE.test(password),
    noEdgeSpace: password.length > 0 && password === password.trim(),
  };
}

export function isStrongPassword(password: string) {
  const c = passwordChecks(password);
  return (
    c.minLength && c.upper && c.lower && c.digit && c.special && c.noEdgeSpace
  );
}
