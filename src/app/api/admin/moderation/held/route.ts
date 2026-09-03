import { parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { adminListHeld } from "@/lib/admin-service";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const { page, limit, offset } = parseAdminPage(new URL(req.url));
  const { total, items } = adminListHeld(offset, limit);
  return noStoreJson({ ok: true, page, limit, total, items });
}
