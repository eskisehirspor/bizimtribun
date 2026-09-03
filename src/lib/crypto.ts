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

export function otpCodeHash(participantId: number, code: string) {
  return hmac(`otp:${participantId}:${code}`);
}

export function makeVoteGrant(participantId: number) {
  return `${participantId}.${hmac(`vote-grant:${participantId}`)}`;
}

export function readVoteGrant(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const id = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isInteger(id) || id < 1 || !/^[a-f0-9]{64}$/.test(sig)) return null;
  const expected = hmac(`vote-grant:${id}`);
  if (!safeEqual(expected, sig)) return null;
  return id;
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
