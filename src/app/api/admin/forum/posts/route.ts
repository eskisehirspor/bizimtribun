import { likeQuery, parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listAdminPosts } from "@/lib/admin-service";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const deletedRaw = url.searchParams.get("deleted");
  const deleted =
    deletedRaw === "deleted" ? "deleted" : deletedRaw === "live" ? "live" : "all";
  const topicRaw = url.searchParams.get("topic");
  const topicId = topicRaw ? parseIdParam(topicRaw) : null;

  const { total, items } = listAdminPosts({
    q: likeQuery(url.searchParams.get("q")),
    teamId: url.searchParams.get("team")?.trim() || null,
    topicId,
    deleted,
    offset,
    limit,
  });

  return noStoreJson({ ok: true, page, limit, total, items });
}
