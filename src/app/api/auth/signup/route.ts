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
import { SIGNUP_PER_IP_HOUR, SIGNUP_TICKET_COOKIE } from "@/lib/policy";
import { findUserById, toPublicUser } from "@/lib/users";

const Body = z.object({
  username: z.string().min(3).max(20),
  displayName: z.string().max(40).optional().nullable(),
  city: z.string().max(40).optional().nullable(),
  teamId: z.string().min(1).max(64),
  /** The client must show and the user must accept that the team is permanent. */
  confirmTeamLocked: z.literal(true),
  acceptTerms: z.literal(true),
});

function maskPhone(norm: string) {
  return `${norm.slice(0, 3)} *** ** ${norm.slice(8)}`;
}

export async function GET(req: Request) {
  const ticket = lookupSignupTicket(getDb(), await readCookie(req, SIGNUP_TICKET_COOKIE));
  if (!ticket) return noStoreJson({ ok: true, ticket: false });
  return noStoreJson({ ok: true, ticket: true, phoneMasked: maskPhone(ticket.phoneNorm) });
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson(
      { error: "Kullanıcı adı, takım ve takımın kalıcı olduğunu onaylaman gerekiyor." },
      400,
    );
  }

  const db = getDb();
  const ipKey = hmac(`signup-ip:${await requestIpKey()}`);
  if (rateCount(db, ipKey, 60 * 60 * 1000) >= SIGNUP_PER_IP_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra tekrar dene." }, 429);
  }
  rateNote(db, ipKey);

  const result = signupWithTicket(db, {
    ticketRaw: await readCookie(req, SIGNUP_TICKET_COOKIE),
    username: parsed.data.username,
    displayName: parsed.data.displayName,
    city: parsed.data.city,
    teamId: parsed.data.teamId,
  });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);

  const user = findUserById(result.userId)!;
  const raw = createSession(user.id);
  const res = noStoreJson({ ok: true, user: toPublicUser(user) });
  res.cookies.set(SIGNUP_TICKET_COOKIE, "", { ...signupTicketCookieOptions(0), maxAge: 0 });
  return attachSessionCookie(res, raw, sessionTtlMsForUser(user));
}
