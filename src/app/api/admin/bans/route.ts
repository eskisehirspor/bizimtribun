import { parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listBans } from "@/lib/admin-service";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const state = url.searchParams.get("state") === "all" ? "all" : "active";

  const { total, items } = listBans({ state, offset, limit });
  return noStoreJson({ ok: true, page, limit, total, items, state });
}
