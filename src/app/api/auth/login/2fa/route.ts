import { z } from "zod";
import { hmac } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { findUserById, isUserBanned, reconcileExpiredBan, toPublicUser } from "@/lib/users";
import {
  attachSessionCookie,
  clearAdmin2faCookie,
  createSession,
  readAdmin2faToken,
  sessionTtlMsForUser,
} from "@/lib/auth";
import { completeLoginChallenge } from "@/lib/admin-2fa";

const Body = z.object({
  code: z.string().min(6).max(32),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }

  const challenge = await readAdmin2faToken(req);
  if (!challenge) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }

  const ipHash = hashedIp(`auth-totp:${await clientIp()}`);
  const uaHash = hmac(`ua:${req.headers.get("user-agent") || ""}`);
  const result = completeLoginChallenge(getDb(), challenge, parsed.data.code, {
    ipHash,
    uaHash,
  });
  if (!result.ok) {
    return noStoreJson({ error: result.error }, result.status);
  }

  const loaded = findUserById(result.userId);
  if (!loaded) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }
  const user = reconcileExpiredBan(loaded);
  if (isUserBanned(user)) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }

  const raw = createSession(user.id);
  const res = noStoreJson({
    ok: true,
    user: toPublicUser({ ...user, last_login_at: new Date().toISOString() }),
  });
  attachSessionCookie(res, raw, sessionTtlMsForUser(user));
  return clearAdmin2faCookie(res);
}
