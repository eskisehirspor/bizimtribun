import { requireAdminResponse } from "@/lib/admin-http";
import { adminRevealPhone } from "@/lib/admin-service";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson } from "@/lib/http";

/** POST (not GET) so the number is never prefetched or cached; every call is audited. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminResponse(req, "users.phone");
  if (!gate.ok) return gate.res;

  const { id: raw } = await ctx.params;
  const id = parseIdParam(raw);
  if (id == null) return noStoreJson({ error: "Kullanıcı bulunamadı." }, 404);

  const result = await adminRevealPhone(id, gate.user);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true, phone: result.phone });
}
