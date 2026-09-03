import { noStoreJson } from "@/lib/http";
import { clientIp, isBrowserSameSite } from "@/lib/request";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { sendUserVerifyEmail } from "@/lib/mail";
import {
  USER_VERIFY_ALREADY,
  USER_VERIFY_GENERIC_SENT,
  issueUserEmailToken,
  noteUserEmailResend,
  userEmailResendLimited,
} from "@/lib/user-email";

export async function POST(req: Request) {
  if (!isBrowserSameSite(req)) {
    return noStoreJson({ error: "Geçersiz kaynak." }, 400);
  }

  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  if (active.user.email_verified_at) {
    return noStoreJson({ ok: true, message: USER_VERIFY_ALREADY });
  }

  const ip = await clientIp();
  const limited = userEmailResendLimited(ip, active.user.id);
  if (limited.limited) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }

  const raw = issueUserEmailToken(active.user.id);
  try {
    await sendUserVerifyEmail(active.user.email, raw);
  } catch {
    return noStoreJson(
      { error: "Doğrulama maili şu an gönderilemiyor." },
      503,
    );
  }
  noteUserEmailResend(ip, active.user.id);
  return noStoreJson({ ok: true, message: USER_VERIFY_GENERIC_SENT });
}
