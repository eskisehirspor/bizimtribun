import { z } from "zod";
import { identityPhoneHash } from "@/lib/crypto";
import { hashedIp, findByPhoneHash, registerAttemptCount } from "@/lib/stats";
import { isTrMobile, normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/request";
import { VERIFY_PER_HOUR } from "@/lib/policy";
import { getDb } from "@/lib/db";
import { isOtpCode, noStoreJson, readJsonBody } from "@/lib/http";
import { consumePhoneOtp } from "@/lib/otp";

const Body = z.object({
  phone: z.string().min(10).max(20),
  code: z.string(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Telefon ve 6 haneli kod gerekli." }, 400);
  }

  const phoneNorm = normalizePhone(parsed.data.phone);
  if (!isTrMobile(phoneNorm) || !isOtpCode(parsed.data.code)) {
    return noStoreJson({ error: "Kod geçersiz veya süresi doldu." }, 400);
  }

  const ipHash = hashedIp(`otp-verify:${await clientIp()}`);
  if (registerAttemptCount(ipHash) >= VERIFY_PER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());

  const phoneHash = identityPhoneHash(phoneNorm);
  const participant = findByPhoneHash(phoneHash);
  if (!participant || participant.deleted_at) {
    return noStoreJson({ error: "Kod geçersiz veya süresi doldu." }, 400);
  }
  if (participant.phone_verified_at) {
    return noStoreJson({ error: "Telefon zaten doğrulanmış." }, 409);
  }

  const result = consumePhoneOtp({
    participantId: participant.id,
    phoneHash,
    code: parsed.data.code,
    teamId: participant.team_id,
    city: participant.city,
  });

  if (!result.ok) {
    return noStoreJson({ error: result.error }, 400);
  }

  return noStoreJson({ ok: true, message: "Telefon doğrulandı." });
}
