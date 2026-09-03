import { likeQuery, parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listModeration, parseOptionalIso } from "@/lib/admin-service";
import { parseIdParam } from "@/lib/forum";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const action = url.searchParams.get("action")?.trim().slice(0, 64) || null;
  const moderatorRaw = url.searchParams.get("moderator")?.trim() || null;
  const moderatorId = moderatorRaw && /^\d+$/.test(moderatorRaw) ? parseIdParam(moderatorRaw) : null;
  const userRaw = url.searchParams.get("user")?.trim() || null;

  const { total, items } = listModeration({
    action,
    moderatorId,
    moderatorQ: moderatorId ? null : likeQuery(moderatorRaw),
    targetUserId: userRaw ? parseIdParam(userRaw) : null,
    from: parseOptionalIso(
      /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "")
        ? `${url.searchParams.get("from")}T00:00:00.000Z`
        : url.searchParams.get("from"),
    ),
    to: parseOptionalIso(
      /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "")
        ? `${url.searchParams.get("to")}T23:59:59.999Z`
        : url.searchParams.get("to"),
    ),
    offset,
    limit,
  });

  return noStoreJson({ ok: true, page, limit, total, items });
}
