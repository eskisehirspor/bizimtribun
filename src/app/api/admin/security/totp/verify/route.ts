import { z } from "zod";
import { hmac } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { requireAdminResponse } from "@/lib/admin-http";
import { confirmTotpSetup } from "@/lib/admin-2fa";
import { clientIp } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({
  code: z.string().min(6).max(16),
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

  const result = confirmTotpSetup(getDb(), gate.user.id, parsed.data.code, {
    ipHash: hashedIp(`auth-totp:${await clientIp()}`),
    uaHash: hmac(`ua:${req.headers.get("user-agent") || ""}`),
  });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);

  return noStoreJson({
    ok: true,
    recoveryCodes: result.recoveryCodes,
  });
}
