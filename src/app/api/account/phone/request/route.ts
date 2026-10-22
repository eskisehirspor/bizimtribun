import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { requestOtp } from "@/lib/auth-otp";
import { findVerifiedUserByPhone } from "@/lib/accounts";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { checkCaptcha, parseTrPhone, PHONE_FORMAT_ERROR, requestIpKey } from "@/lib/otp-http";

const Body = z.object({
  phone: z.string().max(24),
  captchaToken: z.string().max(4096).optional(),
});

/** Signed-in account (e.g. an older password account) asks to verify a phone. */
export async function POST(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  if (active.user.phone_verified_at) {
    return noStoreJson({ error: "Telefonun zaten doğrulanmış." }, 409);
  }
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);
  const phoneNorm = parseTrPhone(parsed.data.phone);
  if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);

  const ip = await requestIpKey();
  const captcha = await checkCaptcha(parsed.data.captchaToken, ip);
  if (captcha) return noStoreJson({ error: captcha.error }, captcha.status);

  const db = getDb();
  const holder = await findVerifiedUserByPhone(db, phoneNorm);
  if (holder && holder.id !== active.user.id) {
    return noStoreJson({ error: "Bu telefon başka bir hesapta doğrulanmış." }, 409);
  }
  const result = await requestOtp(db, {
    phoneNorm,
    ipKey: ip,
    purpose: "bind",
    userId: active.user.id,
  });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({
    ok: true,
    message: "Doğrulama kodu SMS ile gönderildi.",
    expiresInSec: result.expiresInSec,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
}
