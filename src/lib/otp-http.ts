import { z } from "zod";
import { verifyCaptcha } from "./captcha";
import { normalizeEmail } from "./crypto";
import { isTrMobile, normalizePhone } from "./phone";
import { clientIp } from "./request";

export const PHONE_FORMAT_ERROR = "Cep telefonunu 5XX XXX XX XX biçiminde yaz.";

export function parseTrPhone(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 24) return null;
  const norm = normalizePhone(raw);
  return isTrMobile(norm) ? norm : null;
}

export const EMAIL_FORMAT_ERROR = "Geçerli bir e-posta adresi yaz.";
export const DISPOSABLE_EMAIL_ERROR =
  "Geçici e-posta adresleriyle üye olunamaz. Kalıcı bir adres kullan.";

const EmailShape = z.email().max(254);

/** The address as typed (trimmed) for sending, and its normalised form for lookups. */
export function parseEmail(raw: unknown) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!EmailShape.safeParse(trimmed).success) return null;
  return { raw: trimmed, norm: normalizeEmail(trimmed) };
}

/** IP is only ever used through an HMAC'd rate-limit key. */
export async function requestIpKey() {
  return clientIp();
}

export async function checkCaptcha(token: unknown, ip: string) {
  const result = await verifyCaptcha(token, ip);
  if (result.ok) return null;
  if (result.reason === "unconfigured") {
    return { status: 503, error: "Bot koruması yapılandırılmadığı için kod gönderilemiyor." };
  }
  if (result.reason === "network") {
    return { status: 503, error: "Bot doğrulaması şu anda yapılamıyor. Biraz sonra dene." };
  }
  return { status: 400, error: "Robot olmadığını doğrula ve tekrar dene." };
}
