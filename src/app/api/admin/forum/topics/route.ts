import { likeQuery, parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listAdminTopics } from "@/lib/admin-service";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const deletedRaw = url.searchParams.get("deleted");
  const deleted =
    deletedRaw === "deleted" ? "deleted" : deletedRaw === "live" ? "live" : "all";

  const { total, items } = listAdminTopics({
    q: likeQuery(url.searchParams.get("q")),
    teamId: url.searchParams.get("team")?.trim() || null,
    deleted,
    offset,
    limit,
  });

  return noStoreJson({ ok: true, page, limit, total, items });
}
