import { requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { approveTeamRequest } from "@/lib/team-requests";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const id = parseIdParam((await ctx.params).id);
  if (id == null) {
    return noStoreJson({ error: "Talep bulunamadı." }, 404);
  }

  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const reasonRaw =
    body.data && typeof body.data === "object" && "reason" in body.data
      ? (body.data as { reason?: unknown }).reason
      : null;
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim()
      ? reasonRaw.trim().slice(0, 500)
      : null;

  const result = approveTeamRequest(getDb(), id, gate.user.id, reason);
  if (!result.ok) {
    return noStoreJson({ error: result.error }, result.status);
  }

  return noStoreJson({
    ok: true,
    teamId: result.teamId,
    created: result.created,
    forumActive: result.forumActive,
  });
}
