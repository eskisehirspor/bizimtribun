import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { PASSWORD_RULE_ERROR } from "@/lib/accounts";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { hashPassword, isStrongPassword, verifyPassword } from "@/lib/password";

const Body = z
  .object({
    password: z.string().max(128),
    currentPassword: z.string().max(128).optional(),
  })
  .strict();

/** Whether the member has a password, so /hesap can say "set" or "change". */
export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({ ok: true, hasPassword: Boolean(active.user.password_hash) });
}

/**
 * Sets or changes the password. Changing one needs the current password;
 * a forgotten one is reset from the mailed link instead. Other sessions stay
 * signed in.
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  if (!isStrongPassword(parsed.data.password)) {
    return noStoreJson({ error: PASSWORD_RULE_ERROR }, 400);
  }

  const db = getDb();
  const user = active.user;
  if (user.password_hash) {
    const current = parsed.data.currentPassword ?? "";
    if (!current || !(await verifyPassword(current, user.password_hash))) {
      return noStoreJson({ error: "Mevcut şifren hatalı." }, 403);
    }
  }

  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
    .run(await hashPassword(parsed.data.password), now, user.id);
  await writeAudit(db, {
    actorUserId: user.id,
    action: user.password_hash ? "password_changed" : "password_set",
    targetType: "user",
    targetId: user.id,
  });
  return noStoreJson({ ok: true });
}
