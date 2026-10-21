import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { requestOtp } from "@/lib/auth-otp";
import { checkCaptcha, parseTrPhone, PHONE_FORMAT_ERROR, requestIpKey } from "@/lib/otp-http";

const Body = z.object({
  phone: z.string().max(24),
  captchaToken: z.string().max(4096).optional(),
});

/**
 * Step 1 of sign-in and sign-up: send a code to the number. The answer is
 * the same whether or not an account exists, so this cannot be used to look
 * up who is registered.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);
  const phoneNorm = parseTrPhone(parsed.data.phone);
  if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);

  const ip = await requestIpKey();
  const captcha = await checkCaptcha(parsed.data.captchaToken, ip);
  if (captcha) return noStoreJson({ error: captcha.error }, captcha.status);

  const result = await requestOtp(getDb(), { phoneNorm, ipKey: ip, purpose: "login" });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({
    ok: true,
    message: "Doğrulama kodu SMS ile gönderildi.",
    expiresInSec: result.expiresInSec,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
}
