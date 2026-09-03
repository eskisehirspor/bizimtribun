import { hmac } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { requireAdminResponse } from "@/lib/admin-http";
import { recordSecurityEvent, startTotpSetup } from "@/lib/admin-2fa";
import { clientIp, isBrowserSameSite } from "@/lib/request";
import { hashedIp } from "@/lib/stats";
import { noStoreJson } from "@/lib/http";

export async function POST(req: Request) {
  if (!isBrowserSameSite(req)) {
    return noStoreJson({ error: "Geçersiz kaynak." }, 400);
  }

  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const result = startTotpSetup(getDb(), gate.user);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);

  recordSecurityEvent(getDb(), {
    userId: gate.user.id,
    action: "totp_setup_start",
    success: true,
    ipHash: hashedIp(`sec:${await clientIp()}`),
    uaHash: hmac(`ua:${req.headers.get("user-agent") || ""}`),
  });

  return noStoreJson({
    ok: true,
    secret: result.secret,
    otpauthUrl: result.otpauthUrl,
  });
}
