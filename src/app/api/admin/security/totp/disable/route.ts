import { z } from "zod";
import { hmac } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { requireAdminResponse } from "@/lib/admin-http";
import { disableTotp, totpVerifyLimited, noteTotpVerifyAttempt } from "@/lib/admin-2fa";
import { clientIp } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { verifyPassword } from "@/lib/password";

const Body = z.object({
  password: z.string().min(1).max(128),
  code: z.string().min(6).max(32),
});

export async function POST(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }

  const ipHash = hashedIp(`auth-totp:${await clientIp()}`);
  const db = getDb();
  if (totpVerifyLimited(db, ipHash, gate.user.id)) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  noteTotpVerifyAttempt(db, ipHash, gate.user.id);

  const passwordOk = await verifyPassword(
    parsed.data.password,
    gate.user.password_hash,
  );
  if (!passwordOk) {
    return noStoreJson({ error: "Doğrulama kodu hatalı." }, 401);
  }

  const result = disableTotp(db, gate.user, parsed.data.code, {
    ipHash,
    uaHash: hmac(`ua:${req.headers.get("user-agent") || ""}`),
  });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true });
}
