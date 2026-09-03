import { z } from "zod";
import { identityPhoneHash } from "@/lib/crypto";
import { hashedIp } from "@/lib/stats";
import { isTrMobile, normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { requestPhoneOtp } from "@/lib/otp";
import { getDb } from "@/lib/db";
import { smsDeliveryAvailable } from "@/lib/sms";
import {
  otpRequestAcceptedBody,
  preludeOtpRequest,
} from "@/lib/otp-request";

const Body = z.object({
  phone: z.string().min(10).max(20),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Geçerli telefon yaz." }, 400);
  }

  const phoneNorm = normalizePhone(parsed.data.phone);
  if (!isTrMobile(phoneNorm)) {
    return noStoreJson(
      { error: "Telefonu 5XX XXX XX XX formatında yaz." },
      400,
    );
  }

  const db = getDb();
  const ipHash = hashedIp(`otp:${await clientIp()}`);
  const phoneHash = identityPhoneHash(phoneNorm);
  const phoneKey = hashedIp(`otp-phone:${phoneHash}`);

  const prelude = preludeOtpRequest(db, { ipHash, phoneKey, phoneHash });
  if (!prelude.ok) {
    return noStoreJson({ error: prelude.error }, prelude.status);
  }

  if (!smsDeliveryAvailable()) {
    return noStoreJson({ error: "Telefon doğrulama henüz aktif değil." }, 503);
  }

  let devCode: string | undefined;
  if (prelude.dispatch && prelude.participant) {
    const result = await requestPhoneOtp({
      participantId: prelude.participant.id,
      phoneNorm,
      phoneHash,
      alreadyVerified: false,
    });
    if (result.ok) {
      devCode = result.devCode;
    }
    // Gönderim 429/502/503 olsa bile kayıt varlığını sızdırmamak için
    // dışarıya aynı generic 200 döneriz. Rate limit prelude'da uygulanır.
  }

  return noStoreJson(otpRequestAcceptedBody(devCode ? { devCode } : undefined));
}
