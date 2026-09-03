import { z } from "zod";
import { TEAM_IDS } from "@/lib/teams";
import { PROVINCES } from "@/lib/provinces";
import { isDisposableEmail } from "@/lib/disposable";
import { SEED_DOMAIN } from "@/lib/seed-votes";
import { hmac, identityEmailHash, identityPhoneHash, newToken, normalizeEmail, sha256 } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { getDb } from "@/lib/db";
import { sendVerifyEmail } from "@/lib/mail";
import {
  CONSENT_VERSION,
  REGISTER_PER_HOUR,
  TOKEN_TTL_MS,
} from "@/lib/policy";
import { isTrMobile, normalizePhone } from "@/lib/phone";
import { cleanPersonName, isPersonName } from "@/lib/name";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { voidParticipantOtps } from "@/lib/otp";
import {
  findByEmailHash,
  findByEmailNorm,
  findByPhoneHash,
  fingerprintUsedRecently,
  hashedIp,
  identityConsumed,
  ipLocked,
  registerAttemptCount,
} from "@/lib/stats";

const Body = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(120),
  teamId: z.string().refine((id) => TEAM_IDS.includes(id)),
  city: z.string().refine((c) => (PROVINCES as readonly string[]).includes(c)),
  fingerprint: z.string().min(32).max(128).regex(/^[a-f0-9]+$/i),
  kvkk: z.literal(true),
  riza: z.literal(true),
  website: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson(
      { error: "Formu eksiksiz doldur. İsim, soyisim, KVKK ve açık rıza zorunlu." },
      400,
    );
  }

  const firstName = cleanPersonName(parsed.data.firstName);
  const lastName = cleanPersonName(parsed.data.lastName);
  if (!isPersonName(firstName) || !isPersonName(lastName)) {
    return noStoreJson(
      { error: "İsim ve soyisimi harflerle, ayrı ayrı yaz." },
      400,
    );
  }

  const { phone, email, teamId, city, fingerprint, website } = parsed.data;
  if (website) {
    return noStoreJson({ ok: true });
  }

  const phoneNorm = normalizePhone(phone);
  if (!isTrMobile(phoneNorm)) {
    return noStoreJson(
      { error: "Telefonu 5XX XXX XX XX formatında, gerçek numara olarak yaz." },
      400,
    );
  }

  const emailNorm = normalizeEmail(email);
  if (emailNorm.endsWith(`@${SEED_DOMAIN}`) || isDisposableEmail(emailNorm)) {
    return noStoreJson(
      { error: "Geçici e-posta kabul etmiyoruz. Gerçek bir adres kullan." },
      400,
    );
  }

  const emailHash = identityEmailHash(emailNorm);
  const phoneHash = identityPhoneHash(phoneNorm);

  const ip = await clientIp();
  const ipHash = hashedIp(ip);
  const fpHash = hmac(`fp:${fingerprint}`);

  if (registerAttemptCount(ipHash) >= REGISTER_PER_HOUR) {
    return noStoreJson(
      { error: "Bu IP’den çok fazla deneme oldu. Bir saat sonra dene." },
      429,
    );
  }

  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());

  const byEmail = findByEmailHash(emailHash) ?? findByEmailNorm(emailNorm);
  const byPhone = findByPhoneHash(phoneHash);

  if (identityConsumed(byEmail)) {
    return noStoreJson(
      { error: "Bu e-posta zaten mühürlenmiş. Bir kişi = bir tribün." },
      409,
    );
  }

  if (byPhone && byPhone.id !== byEmail?.id) {
    return noStoreJson(
      { error: "Bu telefon zaten bir mühürde kayıtlı." },
      409,
    );
  }

  if (ipLocked(ipHash) && byEmail?.email_norm !== emailNorm) {
    return noStoreJson(
      { error: "Bu cihazdan kısa süre önce katılım var. Biraz sonra dene." },
      429,
    );
  }

  if (fingerprintUsedRecently(fpHash)) {
    return noStoreJson(
      { error: "Bu cihazdan kısa süre önce mühür basılmış." },
      429,
    );
  }

  const now = new Date().toISOString();
  const token = newToken();
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const tx = getDb().transaction(() => {
    const emailRow = findByEmailHash(emailHash) ?? findByEmailNorm(emailNorm);
    const phoneRow = findByPhoneHash(phoneHash);

    if (identityConsumed(emailRow)) {
      throw new Error("IDENTITY_TAKEN");
    }
    if (phoneRow && phoneRow.id !== emailRow?.id) {
      throw new Error("IDENTITY_TAKEN");
    }

    let id = emailRow?.id;
    if (emailRow && !emailRow.verified_at && !emailRow.deleted_at) {
      getDb()
        .prepare(
          `UPDATE participants
           SET email = ?, email_hash = ?, first_name = ?, last_name = ?,
               phone = ?, phone_norm = ?, phone_hash = ?, phone_verified_at = NULL,
               team_id = ?, city = ?, ip_hash = ?, fingerprint_hash = ?,
               consent_version = ?, consent_at = ?, created_at = ?, deleted_at = NULL
           WHERE id = ?`,
        )
        .run(
          email.trim(),
          emailHash,
          firstName,
          lastName,
          phone.trim(),
          phoneNorm,
          phoneHash,
          teamId,
          city,
          ipHash,
          fpHash,
          CONSENT_VERSION,
          now,
          now,
          emailRow.id,
        );
      getDb()
        .prepare(`DELETE FROM verify_tokens WHERE participant_id = ?`)
        .run(emailRow.id);
      voidParticipantOtps(emailRow.id, now);
    } else {
      const info = getDb()
        .prepare(
          `INSERT INTO participants
           (email, email_norm, email_hash, first_name, last_name, phone, phone_norm, phone_hash,
            team_id, city, ip_hash, fingerprint_hash,
            consent_version, consent_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          email.trim(),
          emailNorm,
          emailHash,
          firstName,
          lastName,
          phone.trim(),
          phoneNorm,
          phoneHash,
          teamId,
          city,
          ipHash,
          fpHash,
          CONSENT_VERSION,
          now,
          now,
        );
      id = Number(info.lastInsertRowid);
    }

    getDb()
      .prepare(
        `INSERT INTO verify_tokens (participant_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
      )
      .run(id, tokenHash, expires);

    getDb()
      .prepare(
        `INSERT INTO ip_locks (ip_hash, last_at) VALUES (?, ?)
         ON CONFLICT(ip_hash) DO UPDATE SET last_at = excluded.last_at`,
      )
      .run(ipHash, now);
  });

  try {
    tx();
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    const msg = err instanceof Error ? err.message : "";
    if (code.includes("CONSTRAINT") || msg === "IDENTITY_TAKEN") {
      return noStoreJson(
        { error: "Bu e-posta veya telefon zaten mühürde kayıtlı." },
        409,
      );
    }
    return noStoreJson({ error: "Kayıt alınamadı. Biraz sonra dene." }, 500);
  }

  try {
    const sent = await sendVerifyEmail(email.trim(), token);
    return noStoreJson({
      ok: true,
      message:
        "Doğrulama maili yola çıktı. Kutunu ve spam klasörünü kontrol et.",
      ...(sent.dev && process.env.NODE_ENV !== "production"
        ? { devLink: sent.link }
        : {}),
    });
  } catch {
    return noStoreJson(
      { error: "Mail gönderilemedi. Adresi kontrol edip tekrar dene." },
      502,
    );
  }
}
