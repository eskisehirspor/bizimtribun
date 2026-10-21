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
import {
  attachAdmin2faCookie,
  attachSessionCookie,
  createSession,
  readCookie,
  sessionTtlMsForUser,
  signupTicketCookieOptions,
} from "@/lib/auth";
import { createLoginChallenge, passwordLoginNextStep, recordSecurityEvent } from "@/lib/admin-2fa";
import { isUserBanned, reconcileExpiredBan, toPublicUser } from "@/lib/users";
import { hashedIp } from "@/lib/stats";
import { DEVICE_COOKIE, SIGNUP_TICKET_COOKIE, SIGNUP_TICKET_TTL_MS } from "@/lib/policy";

const Body = z.object({
  phone: z.string().max(24).optional(),
  email: z.string().max(254).optional(),
  code: z.string().max(12),
});

/**
 * Step 2: check the code. A verified account on this e-mail (or number, in
 * SMS mode) signs in; otherwise a short-lived sign-up ticket (httpOnly
 * cookie) is issued and the client continues with username + team.
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
      ? verifyEmailOtp(db, { emailNorm: identity.emailNorm, code, ipKey: ip, purpose: "login" })
      : verifyOtp(db, { phoneNorm: identity.phoneNorm, code, ipKey: ip, purpose: "login" });
  if (!result.ok) {
    recordSecurityEvent(db, { action: "otp_verify", success: false, ipHash: hashedIp(ip) });
    return noStoreJson({ error: result.error }, result.status);
  }

  const existing =
    identity.channel === "email"
      ? findVerifiedUserByEmail(db, identity.emailNorm)
      : findVerifiedUserByPhone(db, identity.phoneNorm);
  if (existing) {
    const user = reconcileExpiredBan(existing);
    if (isUserBanned(user)) {
      recordSecurityEvent(db, { userId: user.id, action: "otp_login_banned", success: false, ipHash: hashedIp(ip) });
      return noStoreJson({ error: "Hesap askıya alınmış." }, 403);
    }
    recordSecurityEvent(db, { userId: user.id, action: "otp_login", success: true, ipHash: hashedIp(ip) });
    if (passwordLoginNextStep(user) === "need2fa") {
      const challenge = createLoginChallenge(db, user.id);
      return attachAdmin2faCookie(noStoreJson({ ok: true, next: "2fa" }), challenge);
    }
    const raw = createSession(user.id);
    const res = noStoreJson({ ok: true, next: "home", user: toPublicUser(user) });
    return attachSessionCookie(res, raw, sessionTtlMsForUser(user));
  }

  if (identity.channel === "sms" && phoneHoldActive(db, identity.phoneNorm)) {
    return noStoreJson({ error: PHONE_HOLD_ERROR }, 409);
  }
  if (identity.channel === "email" && emailHoldActive(db, identity.emailNorm)) {
    return noStoreJson({ error: EMAIL_HOLD_ERROR }, 409);
  }
  // Say so now rather than after the member has filled in the sign-up form.
  if (!getSettings().features.signupsOpen) {
    return noStoreJson({ error: "Yeni üyelik şu an kapalı. Daha sonra tekrar dene." }, 403);
  }

  // Checked again, authoritatively, when the account is created.
  const device = await readCookie(req, DEVICE_COOKIE);
  if (!isDeviceId(device)) return noStoreJson({ error: DEVICE_COOKIE_ERROR }, 400);
  if (deviceLimitReached(db, deviceHash(device))) {
    return noStoreJson({ error: DEVICE_LIMIT_ERROR }, 429);
  }

  const ticket = issueSignupTicket(db, identity);
  const res = noStoreJson({
    ok: true,
    next: "signup",
    legacyAccountHint:
      identity.channel === "email"
        ? hasUnverifiedEmailClaim(db, identity.emailNorm)
        : hasUnverifiedClaim(db, identity.phoneNorm),
  });
  res.cookies.set(
    SIGNUP_TICKET_COOKIE,
    ticket,
    signupTicketCookieOptions(Math.floor(SIGNUP_TICKET_TTL_MS / 1000)),
  );
  return res;
}
