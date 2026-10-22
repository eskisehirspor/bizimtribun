import { z } from "zod";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { checkCaptcha, EMAIL_FORMAT_ERROR, parseEmail, requestIpKey } from "@/lib/otp-http";
import { PASSWORD_RESET_SENT, requestPasswordReset } from "@/lib/password-reset";

const Body = z.object({
  email: z.string().max(254),
  captchaToken: z.string().max(4096).optional(),
});

/** "Şifremi unuttum": mails a one-time link. Same answer for every address. */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  const email = parsed.success ? parseEmail(parsed.data.email) : null;
  if (!parsed.success || !email) return noStoreJson({ error: EMAIL_FORMAT_ERROR }, 400);

  const ip = await requestIpKey();
  const captcha = await checkCaptcha(parsed.data.captchaToken, ip);
  if (captcha) return noStoreJson({ error: captcha.error }, captcha.status);

  try {
    const result = await requestPasswordReset(email.norm, ip);
    if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  } catch {
    return noStoreJson({ error: "Mail şu anda gönderilemedi. Biraz sonra tekrar dene." }, 503);
  }
  return noStoreJson({ ok: true, message: PASSWORD_RESET_SENT });
}
