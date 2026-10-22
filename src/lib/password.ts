import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export { isStrongPassword, PASSWORD_RULE_LABELS, passwordChecks, type PasswordChecks } from "./password-rules";
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

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored) {
    // Phone-only accounts have no password. Burn the same scrypt cost.
    await scryptKey(password, Buffer.alloc(16));
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || expected.length !== KEY_LEN) return false;
  const key = await scryptKey(password, salt);
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
