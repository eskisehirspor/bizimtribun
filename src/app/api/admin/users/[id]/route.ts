import { requireAdminResponse } from "@/lib/admin-http";
import { getAdminUserDetail } from "@/lib/admin-service";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson } from "@/lib/http";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const { id: raw } = await ctx.params;
  const id = parseIdParam(raw);
  if (id == null) return noStoreJson({ error: "Kullanıcı bulunamadı." }, 404);

  const user = getAdminUserDetail(id);
  if (!user) return noStoreJson({ error: "Kullanıcı bulunamadı." }, 404);
  return noStoreJson({ ok: true, user });
}
