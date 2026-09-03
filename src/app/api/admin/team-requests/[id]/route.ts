import { requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson } from "@/lib/http";
import { getTeamRequestGroup } from "@/lib/team-requests";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const id = parseIdParam((await ctx.params).id);
  if (id == null) {
    return noStoreJson({ error: "Talep bulunamadı." }, 404);
  }

  const group = getTeamRequestGroup(getDb(), id);
  if (!group) {
    return noStoreJson({ error: "Talep bulunamadı." }, 404);
  }

  return noStoreJson({ ok: true, group });
}
