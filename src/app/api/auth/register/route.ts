import { z } from "zod";
import { isProvince } from "@/lib/provinces";
import { isDisposableEmail } from "@/lib/disposable";
import { SEED_DOMAIN } from "@/lib/seed-votes";
import { normalizeEmail } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { hashPassword, isStrongPassword } from "@/lib/password";
import { parseIsoBirthDate } from "@/lib/birth-date";
import { cleanPersonName, displayNameFromParts, isPersonName } from "@/lib/name";
import { isTrMobile, normalizePhone } from "@/lib/phone";
import { membershipTeamExists } from "@/lib/team-db";
import {
  authRegisterLimited,
  findUserByEmailNorm,
  findUserByPhoneNorm,
  findUserByUsernameNorm,
  isUsername,
  normalizeUsername,
  noteAuthAttempt,
  toPublicUser,
} from "@/lib/users";
import { sendUserVerifyEmail } from "@/lib/mail";
import { issueUserEmailToken } from "@/lib/user-email";
import { applyDevAdminBootstrap } from "@/lib/admin-bootstrap";
import { attachSessionCookie, createSession, sessionTtlMsForUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const Body = z.object({
  username: z.string().min(3).max(20),
  firstName: z.string().min(2).max(40),
  lastName: z.string().min(2).max(40),
  birthDate: z.string().min(10).max(10),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(120),
  city: z.string().min(2).max(40),
  teamId: z.string().min(1).max(64),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson(
      { error: "Üyelik bilgileri eksik veya geçersiz." },
      400,
    );
  }

  const ipHash = hashedIp(`auth-reg:${await clientIp()}`);
  if (authRegisterLimited(ipHash)) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  noteAuthAttempt(ipHash);

  const usernameNorm = normalizeUsername(parsed.data.username);
  if (!isUsername(usernameNorm)) {
    return noStoreJson(
      { error: "Kullanıcı adı 3–20 karakter, yalnızca harf, rakam ve alt çizgi." },
      400,
    );
  }

  const firstName = cleanPersonName(parsed.data.firstName);
  const lastName = cleanPersonName(parsed.data.lastName);
  if (!isPersonName(firstName) || !isPersonName(lastName)) {
    return noStoreJson({ error: "Ad ve soyadı doğru yaz." }, 400);
  }

  const birthDate = parseIsoBirthDate(parsed.data.birthDate);
  if (!birthDate) {
    return noStoreJson({ error: "Doğum tarihi geçerli bir tarih olmalı." }, 400);
  }

  const phoneNorm = normalizePhone(parsed.data.phone);
  if (!isTrMobile(phoneNorm)) {
    return noStoreJson({ error: "Cep telefonu 5XX XXX XX XX formatında olmalı." }, 400);
  }

  const emailNorm = normalizeEmail(parsed.data.email);
  if (emailNorm.endsWith(`@${SEED_DOMAIN}`) || isDisposableEmail(emailNorm)) {
    return noStoreJson({ error: "Bu e-posta kabul edilmiyor." }, 400);
  }

  const city = parsed.data.city.trim();
  if (!isProvince(city)) {
    return noStoreJson({ error: "İl geçersiz." }, 400);
  }

  const teamId = parsed.data.teamId.trim();
  if (!membershipTeamExists(teamId)) {
    return noStoreJson({ error: "Takım geçersiz." }, 400);
  }

  if (!isStrongPassword(parsed.data.password)) {
    return noStoreJson(
      {
        error:
          "Parola en az 8 karakter olmalı; büyük harf, küçük harf, rakam ve özel karakter içermeli. Başta/sonda boşluk olamaz.",
      },
      400,
    );
  }

  if (
    findUserByUsernameNorm(usernameNorm) ||
    findUserByEmailNorm(emailNorm) ||
    findUserByPhoneNorm(phoneNorm)
  ) {
    return noStoreJson(
      { error: "Bu kullanıcı adı, e-posta veya telefon zaten kayıtlı." },
      409,
    );
  }

  const displayName = displayNameFromParts(firstName, lastName);
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date().toISOString();

  let userId: number;
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO users
         (username, username_norm, display_name, email, email_norm, password_hash,
          team_id, status, role, created_at, updated_at,
          first_name, last_name, birth_date, phone, phone_norm, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'user', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        parsed.data.username.trim(),
        usernameNorm,
        displayName,
        parsed.data.email.trim(),
        emailNorm,
        passwordHash,
        teamId,
        now,
        now,
        firstName,
        lastName,
        birthDate,
        `+90${phoneNorm}`,
        phoneNorm,
        city,
      );
    userId = Number(info.lastInsertRowid);
    applyDevAdminBootstrap();
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code.includes("CONSTRAINT")) {
      return noStoreJson(
        { error: "Bu kullanıcı adı, e-posta veya telefon zaten kayıtlı." },
        409,
      );
    }
    return noStoreJson({ error: "Kayıt alınamadı." }, 500);
  }

  const raw = createSession(userId);
  const row = getDb()
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(userId) as Parameters<typeof toPublicUser>[0];

  const verifyRaw = issueUserEmailToken(userId);
  try {
    await sendUserVerifyEmail(parsed.data.email.trim(), verifyRaw);
  } catch {
    /* resend endpoint handles provider outages */
  }

  const res = noStoreJson({
    ok: true,
    user: toPublicUser(row),
  });
  return attachSessionCookie(res, raw, sessionTtlMsForUser(row));
}
