import { z } from "zod";
import { cleanAdminReason, requireHeldAdminAction } from "@/lib/admin-http";
import { adminApproveHeld } from "@/lib/admin-service";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({
  reason: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const gate = await requireHeldAdminAction(req, ctx);
  if (!gate.ok) return gate.res;

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data ?? {});
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);

  let reason: string | null = null;
  if (parsed.data.reason != null && parsed.data.reason.trim()) {
    reason = cleanAdminReason(parsed.data.reason);
    if (!reason) return noStoreJson({ error: "Gerekçe en az 3 karakter olmalı." }, 400);
  }

  const result = adminApproveHeld(gate.kind, gate.id, gate.user, reason);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true });
}
