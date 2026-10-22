import { z } from "zod";
import { cleanAdminReason, requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { updateTeam } from "@/lib/team-admin";

const Body = z.object({
  name: z.string().optional(),
  league: z.string().optional(),
  city: z.string().optional(),
  colorPrimary: z.string().optional(),
  colorSecondary: z.string().optional(),
  isActive: z.boolean().optional(),
  isForumActive: z.boolean().optional(),
  reason: z.string(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminResponse(req, "teams.manage");
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{1,64}$/.test(id)) return noStoreJson({ error: "Takım bulunamadı." }, 404);

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const reason = cleanAdminReason(parsed.data.reason);
  if (!reason) return noStoreJson({ error: "Gerekçe en az 3 karakter olmalı." }, 400);

  const { reason: _reason, ...patch } = parsed.data;
  void _reason;
  const result = await updateTeam(getDb(), gate.user.id, id, patch, reason);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true });
}
