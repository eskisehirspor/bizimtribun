import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { clearSessionCookie, getSessionUser, requireActiveUser } from "@/lib/auth";
import { deleteAccount } from "@/lib/accounts";
import { rateCount, rateNote } from "@/lib/auth-otp";
import { hmac } from "@/lib/crypto";
import { ACCOUNT_DELETE_PER_USER_HOUR } from "@/lib/policy";

const Body = z.object({
  /** Typed by the user as an explicit confirmation. */
  confirm: z.literal("HESABIMI SİL"),
});

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  const active = requireActiveUser(user);
  if (!active.ok && active.status === 401) {
    return noStoreJson({ error: active.error }, active.status);
  }
  // Banned users may still delete their own account (KVKK erasure right).
  const target = active.ok ? active.user : user!;
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Onay için HESABIMI SİL yaz." }, 400);
  }
  const db = getDb();
  const key = hmac(`account-delete:${target.id}`);
  if (rateCount(db, key, 60 * 60 * 1000) >= ACCOUNT_DELETE_PER_USER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra tekrar dene." }, 429);
  }
  rateNote(db, key);
  const result = deleteAccount(db, {
    userId: target.id,
    actorUserId: target.id,
    reason: "self_service",
  });
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return clearSessionCookie(noStoreJson({ ok: true, message: "Hesabın silindi." }));
}
