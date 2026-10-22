import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { verifyOtp } from "@/lib/auth-otp";
import { bindVerifiedPhone } from "@/lib/accounts";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { parseTrPhone, PHONE_FORMAT_ERROR, requestIpKey } from "@/lib/otp-http";
import { findUserById, toPublicUser } from "@/lib/users";

const Body = z.object({
  phone: z.string().max(24),
  code: z.string().max(12),
});

export async function POST(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Telefon ve 6 haneli kod gerekli." }, 400);
  const phoneNorm = parseTrPhone(parsed.data.phone);
  if (!phoneNorm) return noStoreJson({ error: PHONE_FORMAT_ERROR }, 400);

  const db = getDb();
  const result = await verifyOtp(db, {
      phoneNorm,
      code: parsed.data.code.trim(),
      ipKey: await requestIpKey(),
      purpose: "bind",
      userId: active.user.id,
    });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  const bound = await bindVerifiedPhone(db, active.user.id, phoneNorm);
  if (!bound.ok) return noStoreJson({ error: bound.error }, bound.status);
  return noStoreJson({ ok: true, user: toPublicUser((await findUserById(active.user.id))!) });
}
