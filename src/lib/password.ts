import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
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

function scryptKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, SCRYPT_OPTS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Constant-shape stored hash used to run a real scrypt computation when no
 * account exists, so login timing does not reveal whether the login exists.
 */
export const DUMMY_PASSWORD_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(KEY_LEN)}`;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || expected.length !== KEY_LEN) return false;
  const key = await scryptKey(password, salt);
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
