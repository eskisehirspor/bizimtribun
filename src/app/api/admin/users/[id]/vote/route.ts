import { z } from "zod";
import { cleanAdminReason, requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { voidFanVote } from "@/lib/fan-votes";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({ reason: z.string() });

/**
 * Voids a fraudulent vote. The vote stops counting but is never moved to
 * another team or deleted; the audit log records who did it and why.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminResponse(req, "votes.void");
  if (!gate.ok) return gate.res;

  const { id: raw } = await ctx.params;
  const id = parseIdParam(raw);
  if (id == null) return noStoreJson({ error: "Kullanıcı bulunamadı." }, 404);

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const reason = cleanAdminReason(parsed.data.reason);
  if (!reason) return noStoreJson({ error: "Gerekçe en az 3 karakter olmalı." }, 400);

  const db = getDb();
  const result = db.transaction(() =>
    voidFanVote(db, {
      userId: id,
      reason,
      actorUserId: gate.user.id,
      action: "admin_fan_vote_void",
    }),
  )();
  if (!result.ok) return noStoreJson({ error: result.error }, 409);
  return noStoreJson({ ok: true });
}
