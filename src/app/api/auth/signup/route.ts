import { maskEmail, maskPhone } from "@/lib/privacy";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { lookupSignupTicket, signupWithTicket } from "@/lib/accounts";
import { rateCount, rateNote } from "@/lib/auth-otp";
import {
  attachSessionCookie,
  createSession,
  readCookie,
  sessionTtlMsForUser,
  signupTicketCookieOptions,
} from "@/lib/auth";
import { hmac } from "@/lib/crypto";
import { requestIpKey } from "@/lib/otp-http";
import { DEVICE_COOKIE_ERROR, deviceHash, isDeviceId } from "@/lib/device-limit";
import {
  DEVICE_COOKIE,
  SIGNUP_PER_IP_DAY,
  SIGNUP_PER_IP_HOUR,
  SIGNUP_TICKET_COOKIE,
} from "@/lib/policy";
import { findUserById, toPublicUser } from "@/lib/users";
import { getSettings, MAINTENANCE_ERROR } from "@/lib/site-settings";

const Body = z.object({
  username: z.string().min(3).max(20),
  displayName: z.string().max(40).optional().nullable(),
  city: z.string().max(40).optional().nullable(),
  teamId: z.string().min(1).max(64),
  /** The client must show and the user must accept that the team is permanent. */
  confirmTeamLocked: z.literal(true),
  /** Separate, unticked boxes: accepting the terms and acknowledging the KVKK notice. */
  acceptTerms: z.literal(true),
  acknowledgePrivacy: z.literal(true),
  /** 18+, or 13–17 with a parent's permission (see the terms). */
  confirmAge: z.literal(true),
  termsVersion: z.string().max(20),
  privacyVersion: z.string().max(20),
  firstName: z.string().max(40),
  lastName: z.string().max(40),
  birthDate: z.string().max(10),
  phone: z.string().max(24).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  password: z.string().max(128),
});

export async function GET(req: Request) {
  const ticket = await lookupSignupTicket(getDb(), await readCookie(req, SIGNUP_TICKET_COOKIE));
  if (!ticket) return noStoreJson({ ok: true, ticket: false });
  return noStoreJson({
    ok: true,
    ticket: true,
    channel: ticket.channel,
    phoneMasked: ticket.channel === "sms" ? maskPhone(ticket.phoneNorm) : null,
    emailMasked: ticket.channel === "email" ? maskEmail(ticket.email) : null,
  });
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson(
      {
        error:
          "Takma ad, ad soyad, doğum tarihi, takım, takımın kalıcı olduğu, Kullanım Koşulları ve Aydınlatma Metni onayı gerekiyor.",
      },
      400,
    );
  }

  const settings = await getSettings();
  if (settings.maintenance.enabled) return noStoreJson({ error: MAINTENANCE_ERROR }, 503);
  if (!settings.features.signupsOpen) {
    return noStoreJson({ error: "Yeni üyelik şu an kapalı. Daha sonra tekrar dene." }, 403);
  }

  const db = getDb();
  const ipKey = hmac(`signup-ip:${await requestIpKey()}`);
  if (
    await rateCount(db, ipKey, 60 * 60 * 1000) >= SIGNUP_PER_IP_HOUR ||
    await rateCount(db, ipKey, 24 * 60 * 60 * 1000) >= SIGNUP_PER_IP_DAY
  ) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra tekrar dene." }, 429);
  }
  const device = await readCookie(req, DEVICE_COOKIE);
  if (!isDeviceId(device)) return noStoreJson({ error: DEVICE_COOKIE_ERROR }, 400);
  await rateNote(db, ipKey);

  const result = await signupWithTicket(db, {
      ticketRaw: await readCookie(req, SIGNUP_TICKET_COOKIE),
      deviceHash: deviceHash(device),
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      city: parsed.data.city,
      teamId: parsed.data.teamId,
      legal: { termsVersion: parsed.data.termsVersion, privacyVersion: parsed.data.privacyVersion },
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      birthDate: parsed.data.birthDate,
      phone: parsed.data.phone,
      marketingConsent: parsed.data.marketingConsent === true,
      password: parsed.data.password,
    });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);

  const user = (await findUserById(result.userId))!;
  const raw = await createSession(user.id);
  const res = noStoreJson({ ok: true, user: toPublicUser(user) });
  res.cookies.set(SIGNUP_TICKET_COOKIE, "", { ...signupTicketCookieOptions(0), maxAge: 0 });
  return attachSessionCookie(res, raw, sessionTtlMsForUser(user));
}
