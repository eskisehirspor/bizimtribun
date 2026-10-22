import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { pendingLegalDocs, recordLegalAcceptance } from "@/lib/legal";

const Body = z.object({
  accepted: z
    .array(z.object({ doc: z.enum(["terms", "privacy"]), version: z.string().max(20) }))
    .min(1)
    .max(2),
});

export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({ ok: true, pending: await pendingLegalDocs(getDb(), active.user.id) });
}

/** Records that the member accepted the current terms / acknowledged the current notice. */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const db = getDb();
  const result = await db.transaction(() =>
      recordLegalAcceptance(db, { userId: active.user.id, accepted: parsed.data.accepted, source: "reaccept" }),
    )();
  if (!result.ok) return noStoreJson({ error: result.error }, 409);
  return noStoreJson({ ok: true, pending: await pendingLegalDocs(db, active.user.id) });
}
