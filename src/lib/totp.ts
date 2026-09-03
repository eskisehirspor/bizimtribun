import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SEC = 30;
export const TOTP_DIGITS = 6;
export const TOTP_SKEW_STEPS = 1;
export const TOTP_ISSUER = "Bizim Tribün";

export function generateTotpSecret(bytes = 20) {
  return encodeBase32(randomBytes(bytes));
}

export function encodeBase32(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function decodeBase32(input: string) {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number, digits: number) {
  const data = Buffer.alloc(8);
  data.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  data.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(data).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const mod = 10 ** digits;
  return String(bin % mod).padStart(digits, "0");
}

export function totpAt(secretBase32: string, nowMs: number) {
  const secret = decodeBase32(secretBase32);
  if (!secret || secret.length < 10) return null;
  const counter = Math.floor(nowMs / 1000 / TOTP_PERIOD_SEC);
  return hotp(secret, counter, TOTP_DIGITS);
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  nowMs = Date.now(),
) {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const secret = decodeBase32(secretBase32);
  if (!secret || secret.length < 10) return false;
  const counter = Math.floor(nowMs / 1000 / TOTP_PERIOD_SEC);
  const expected = Buffer.from(trimmed);
  for (let delta = -TOTP_SKEW_STEPS; delta <= TOTP_SKEW_STEPS; delta++) {
    const candidate = Buffer.from(hotp(secret, counter + delta, TOTP_DIGITS));
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return true;
    }
  }
  return false;
}

export function totpOtpAuthUrl(input: {
  secret: string;
  accountName: string;
  issuer?: string;
}) {
  const issuer = input.issuer || TOTP_ISSUER;
  const label = encodeURIComponent(`${issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function normalizeTotpInput(raw: string) {
  return raw.trim().replace(/\s+/g, "");
}
