import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

export function getSecret() {
  const secret = process.env.APP_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("APP_SECRET en az 32 karakter olmalı.");
    }
    return secret;
  }
  return secret || "dev-only-secret-change-me";
}

export function hmac(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

/** Irreversible identity traces. Prefixes keep email/phone hashes distinct. */
export function identityEmailHash(emailNorm: string) {
  return hmac(`id-email:${emailNorm}`);
}

export function identityPhoneHash(phoneNorm: string) {
  return hmac(`id-phone:${phoneNorm}`);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function normalizeEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return trimmed;
  const plus = local.split("+")[0];
  const gmail =
    domain === "gmail.com" || domain === "googlemail.com"
      ? plus.replaceAll(".", "")
      : plus;
  return `${gmail}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}
