import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { verifyOtp } from "@/lib/auth-otp";
import { parseTrPhone, PHONE_FORMAT_ERROR, requestIpKey } from "@/lib/otp-http";
import {
  findVerifiedUserByPhone,
  hasUnverifiedClaim,
  issueSignupTicket,
  phoneHoldActive,
  PHONE_HOLD_ERROR,
} from "@/lib/accounts";
import {
  attachAdmin2faCookie,
  attachSessionCookie,
  createSession,
  sessionTtlMsForUser,
  signupTicketCookieOptions,
} from "@/lib/auth";
import { createLoginChallenge, passwordLoginNextStep, recordSecurityEvent } from "@/lib/admin-2fa";
import { isUserBanned, reconcileExpiredBan, toPublicUser } from "@/lib/users";
import { hashedIp } from "@/lib/stats";
import { SIGNUP_TICKET_COOKIE, SIGNUP_TICKET_TTL_MS } from "@/lib/policy";

const Body = z.object({
  phone: z.string().max(24),
  code: z.string().max(12),
});

/**
 * Step 2: check the code. A verified account on this number signs in;
 * otherwise a short-lived sign-up ticket (httpOnly cookie) is issued and the
 * client continues with username + team.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Telefon ve 6 haneli kod gerekli." }, 400);
  const phoneNorm = parseTrPhone(parsed.data.phone);
  if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);

  const db = getDb();
  const ip = await requestIpKey();
  const result = verifyOtp(db, {
    phoneNorm,
    code: parsed.data.code.trim(),
    ipKey: ip,
    purpose: "login",
  });
  if (!result.ok) {
    recordSecurityEvent(db, { action: "otp_verify", success: false, ipHash: hashedIp(ip) });
    return noStoreJson({ error: result.error }, result.status);
  }

  const existing = findVerifiedUserByPhone(db, phoneNorm);
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

  if (phoneHoldActive(db, phoneNorm)) {
    return noStoreJson({ error: PHONE_HOLD_ERROR }, 409);
  }

  const ticket = issueSignupTicket(db, phoneNorm);
  const res = noStoreJson({
    ok: true,
    next: "signup",
    legacyAccountHint: hasUnverifiedClaim(db, phoneNorm),
  });
  res.cookies.set(
    SIGNUP_TICKET_COOKIE,
    ticket,
    signupTicketCookieOptions(Math.floor(SIGNUP_TICKET_TTL_MS / 1000)),
  );
  return res;
}
