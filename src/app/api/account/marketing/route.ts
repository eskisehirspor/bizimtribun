import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { writeAudit } from "@/lib/audit";

const Body = z.object({ consent: z.boolean() }).strict();

/** The member's optional campaign-SMS consent: shown and changeable on /hesap. */
export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({ ok: true, consent: Boolean(active.user.marketing_consent_at) });
}

/** Giving or withdrawing consent is one click either way and is recorded. */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const db = getDb();
  const now = new Date().toISOString();
  await db.prepare(`UPDATE users SET marketing_consent_at = ?, updated_at = ? WHERE id = ?`).run(
        parsed.data.consent ? now : null,
        now,
        active.user.id,
      );
  await writeAudit(db, {
        actorUserId: active.user.id,
        action: parsed.data.consent ? "marketing_consent_given" : "marketing_consent_withdrawn",
        targetType: "user",
        targetId: active.user.id,
      });
  return noStoreJson({ ok: true, consent: parsed.data.consent });
}
