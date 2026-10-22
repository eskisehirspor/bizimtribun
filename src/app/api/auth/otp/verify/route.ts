import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/site-settings";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { verifyEmailOtp, verifyOtp } from "@/lib/auth-otp";
import {
  EMAIL_FORMAT_ERROR,
  parseEmail,
  parseTrPhone,
  PHONE_FORMAT_ERROR,
  requestIpKey,
} from "@/lib/otp-http";
import {
  emailHoldActive,
  EMAIL_HOLD_ERROR,
  findVerifiedUserByEmail,
  findVerifiedUserByPhone,
  hasUnverifiedClaim,
  hasUnverifiedEmailClaim,
  issueSignupTicket,
  phoneHoldActive,
  PHONE_HOLD_ERROR,
  type TicketIdentity,
} from "@/lib/accounts";
import {
  DEVICE_COOKIE_ERROR,
  DEVICE_LIMIT_ERROR,
  deviceHash,
  deviceLimitReached,
  isDeviceId,
} from "@/lib/device-limit";
import { verifyChannel } from "@/lib/verify-channel";
import { readCookie, signupTicketCookieOptions } from "@/lib/auth";
import { recordSecurityEvent } from "@/lib/admin-2fa";
import { hashedIp } from "@/lib/stats";
import { ALREADY_MEMBER_ERROR, DEVICE_COOKIE, SIGNUP_TICKET_COOKIE, SIGNUP_TICKET_TTL_MS } from "@/lib/policy";

const Body = z.object({
  phone: z.string().max(24).optional(),
  email: z.string().max(254).optional(),
  code: z.string().max(12),
});

/**
 * Step 2 of sign-up: check the code and issue a short-lived sign-up ticket
 * (httpOnly cookie); the client continues with username + team. An address
 * that already has an account is sent to the password sign-in.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  const channel = verifyChannel();
  if (!parsed.success) {
    return noStoreJson(
      { error: channel === "email" ? "E-posta ve 6 haneli kod gerekli." : "Telefon ve 6 haneli kod gerekli." },
      400,
    );
  }

  let identity: TicketIdentity;
  if (channel === "email") {
    const email = parseEmail(parsed.data.email);
    if (!email) return noStoreJson({ error: EMAIL_FORMAT_ERROR }, 400);
    identity = { channel: "email", email: email.raw, emailNorm: email.norm };
  } else {
    const phoneNorm = parseTrPhone(parsed.data.phone);
    if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);
    identity = { channel: "sms", phoneNorm };
  }

  const db = getDb();
  const ip = await requestIpKey();
  const code = parsed.data.code.trim();
  const result =
    identity.channel === "email"
      ? await verifyEmailOtp(db, { emailNorm: identity.emailNorm, code, ipKey: ip, purpose: "login" })
      : await verifyOtp(db, { phoneNorm: identity.phoneNorm, code, ipKey: ip, purpose: "login" });
  if (!result.ok) {
    await recordSecurityEvent(db, { action: "otp_verify", success: false, ipHash: hashedIp(ip) });
    return noStoreJson({ error: result.error }, result.status);
  }

  const existing =
    identity.channel === "email"
      ? await findVerifiedUserByEmail(db, identity.emailNorm)
      : await findVerifiedUserByPhone(db, identity.phoneNorm);
  // Members sign in with their password; a code only opens sign-up.
  if (existing) {
    return noStoreJson({ error: ALREADY_MEMBER_ERROR, registered: true }, 409);
  }

  if (identity.channel === "sms" && await phoneHoldActive(db, identity.phoneNorm)) {
    return noStoreJson({ error: PHONE_HOLD_ERROR }, 409);
  }
  if (identity.channel === "email" && await emailHoldActive(db, identity.emailNorm)) {
    return noStoreJson({ error: EMAIL_HOLD_ERROR }, 409);
  }
  // Say so now rather than after the member has filled in the sign-up form.
  if (!(await getSettings()).features.signupsOpen) {
    return noStoreJson({ error: "Yeni üyelik şu an kapalı. Daha sonra tekrar dene." }, 403);
  }

  // Checked again, authoritatively, when the account is created.
  const device = await readCookie(req, DEVICE_COOKIE);
  if (!isDeviceId(device)) return noStoreJson({ error: DEVICE_COOKIE_ERROR }, 400);
  if (await deviceLimitReached(db, deviceHash(device))) {
    return noStoreJson({ error: DEVICE_LIMIT_ERROR }, 429);
  }

  const ticket = await issueSignupTicket(db, identity);
  const res = noStoreJson({
    ok: true,
    next: "signup",
    legacyAccountHint:
      identity.channel === "email"
        ? await hasUnverifiedEmailClaim(db, identity.emailNorm)
        : await hasUnverifiedClaim(db, identity.phoneNorm),
  });
  res.cookies.set(
    SIGNUP_TICKET_COOKIE,
    ticket,
    signupTicketCookieOptions(Math.floor(SIGNUP_TICKET_TTL_MS / 1000)),
  );
  return res;
}
