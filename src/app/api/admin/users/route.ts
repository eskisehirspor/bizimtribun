import { likeQuery, parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { listAdminTeamOptions, listAdminUsers } from "@/lib/admin-service";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const roleRaw = url.searchParams.get("role");
  const bannedRaw = url.searchParams.get("banned");
  const teamId = url.searchParams.get("team")?.trim() || null;

  const role = roleRaw === "admin" || roleRaw === "user" ? roleRaw : null;
  const banned = bannedRaw === "1" ? true : bannedRaw === "0" ? false : null;

  const { total, items } = listAdminUsers({
    q: likeQuery(url.searchParams.get("q")),
    role,
    banned,
    teamId,
    offset,
    limit,
  });

  return noStoreJson({
    ok: true,
    page,
    limit,
    total,
    items,
    teams: listAdminTeamOptions(),
  });
}
