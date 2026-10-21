import { parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req, "audit.view");
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const action = url.searchParams.get("action")?.trim().slice(0, 64) || null;
  const { rows, total } = listAudit(getDb(), { limit, offset, action });
  return noStoreJson({
    ok: true,
    page,
    limit,
    total,
    items: rows.map((r) => ({
      id: r.id,
      actor: r.actor_username,
      actorUserId: r.actor_user_id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      meta: r.meta,
      createdAt: r.created_at,
    })),
  });
}
