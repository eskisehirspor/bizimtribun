import { z } from "zod";
import { getDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";
import {
  authLoginLimited,
  findUserByLogin,
  isUserBanned,
  normalizeUsername,
  noteLoginAttempts,
  reconcileExpiredBan,
  toPublicUser,
} from "@/lib/users";
import { applyDevAdminBootstrap } from "@/lib/admin-bootstrap";
import {
  attachAdmin2faCookie,
  attachSessionCookie,
  createSession,
  sessionTtlMsForUser,
} from "@/lib/auth";
import { createLoginChallenge, passwordLoginNextStep } from "@/lib/admin-2fa";

const Body = z.object({
  login: z.string().min(3).max(120),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Giriş bilgileri eksik." }, 400);
  }

  const loginRaw = parsed.data.login.trim();
  const loginKey = loginRaw.includes("@")
    ? normalizeEmail(loginRaw)
    : normalizeUsername(loginRaw);

  const ipHash = hashedIp(`auth-login:${await clientIp()}`);
  if (authLoginLimited(ipHash, loginKey)) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  noteLoginAttempts(ipHash, loginKey);

  const generic = { error: "Kullanıcı adı/e-posta veya parola hatalı." };
  const user = findUserByLogin(loginKey);
  if (!user) {
    // Run the same scrypt cost as a real check so response timing does not
    // leak whether the login (username/email) exists.
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    return noStoreJson(generic, 401);
  }

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) {
    return noStoreJson(generic, 401);
  }

  applyDevAdminBootstrap();
  const fresh = reconcileExpiredBan(findUserByLogin(loginKey) ?? user);

  if (isUserBanned(fresh)) {
    return noStoreJson({ error: "Hesap askıya alınmış." }, 403);
  }

  if (passwordLoginNextStep(fresh) === "need2fa") {
    const challenge = createLoginChallenge(getDb(), fresh.id);
    const res = noStoreJson({ ok: true, need2fa: true });
    return attachAdmin2faCookie(res, challenge);
  }

  const raw = createSession(fresh.id);
  const res = noStoreJson({
    ok: true,
    user: toPublicUser({ ...fresh, last_login_at: new Date().toISOString() }),
  });
  return attachSessionCookie(res, raw, sessionTtlMsForUser(fresh));
}
