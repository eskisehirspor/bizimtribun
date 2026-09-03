import { z } from "zod";
import { cleanAdminReason, requireAdminResponse } from "@/lib/admin-http";
import { deleteTopicAdmin } from "@/lib/admin-service";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({ reason: z.string() });

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const { id: raw } = await ctx.params;
  const id = parseIdParam(raw);
  if (id == null) return noStoreJson({ error: "Konu bulunamadı." }, 404);

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const reason = cleanAdminReason(parsed.data.reason);
  if (!reason) return noStoreJson({ error: "Gerekçe en az 3 karakter olmalı." }, 400);

  const result = deleteTopicAdmin(id, reason, gate.user);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true });
}
