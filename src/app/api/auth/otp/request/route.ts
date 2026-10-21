import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { requestEmailOtp, requestOtp } from "@/lib/auth-otp";
import { readCookie } from "@/lib/auth";
import { ensureDeviceCookie } from "@/lib/device-limit";
import { isDisposableEmail } from "@/lib/disposable";
import {
  checkCaptcha,
  DISPOSABLE_EMAIL_ERROR,
  EMAIL_FORMAT_ERROR,
  parseEmail,
  parseTrPhone,
  PHONE_FORMAT_ERROR,
  requestIpKey,
} from "@/lib/otp-http";
import { DEVICE_COOKIE } from "@/lib/policy";
import { verifyChannel } from "@/lib/verify-channel";

const Body = z.object({
  phone: z.string().max(24).optional(),
  email: z.string().max(254).optional(),
  captchaToken: z.string().max(4096).optional(),
});

/** Which channel the sign-in / sign-up form should ask for. */
export async function GET() {
  return noStoreJson({ ok: true, channel: verifyChannel() });
}

/**
 * Step 1 of sign-in and sign-up: send a code by e-mail or SMS, whichever
 * VERIFY_CHANNEL selects. The answer is the same whether or not an account
 * exists, so this cannot be used to look up who is registered. The browser
 * gets a device cookie here; sign-up counts accounts per device.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  const channel = verifyChannel();
  const formatError = channel === "email" ? EMAIL_FORMAT_ERROR : PHONE_FORMAT_ERROR;
  if (!parsed.success) return noStoreJson({ error: formatError }, 400);

  let phoneNorm: string | null = null;
  let email: { raw: string; norm: string } | null = null;
  if (channel === "email") {
    email = parseEmail(parsed.data.email);
    if (!email) return noStoreJson({ error: EMAIL_FORMAT_ERROR }, 400);
    if (isDisposableEmail(email.norm)) return noStoreJson({ error: DISPOSABLE_EMAIL_ERROR }, 400);
  } else {
    phoneNorm = parseTrPhone(parsed.data.phone);
    if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);
  }

  const ip = await requestIpKey();
  const captcha = await checkCaptcha(parsed.data.captchaToken, ip);
  if (captcha) return noStoreJson({ error: captcha.error }, captcha.status);

  const db = getDb();
  const result = email
    ? await requestEmailOtp(db, {
        emailNorm: email.norm,
        emailTo: email.raw,
        ipKey: ip,
        purpose: "login",
      })
    : await requestOtp(db, { phoneNorm: phoneNorm!, ipKey: ip, purpose: "login" });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  const res = noStoreJson({
    ok: true,
    channel,
    message: email ? "Doğrulama kodu e-postana gönderildi." : "Doğrulama kodu SMS ile gönderildi.",
    expiresInSec: result.expiresInSec,
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
  ensureDeviceCookie(res, await readCookie(req, DEVICE_COOKIE));
  return res;
}
