import { z } from "zod";
import { cleanAdminReason, requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { updateLeague } from "@/lib/team-admin";

const Body = z.object({
  name: z.string().optional(),
  sortOrder: z.number().int().optional(),
  reason: z.string(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminResponse(req, "teams.manage");
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const reason = cleanAdminReason(parsed.data.reason);
  if (!reason) return noStoreJson({ error: "Gerekçe en az 3 karakter olmalı." }, 400);

  const result = updateLeague(
    getDb(),
    gate.user.id,
    id,
    { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
    reason,
  );
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true });
}
