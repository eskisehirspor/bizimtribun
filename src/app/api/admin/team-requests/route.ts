import { likeQuery, parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import {
  TEAM_REQUEST_STATUSES,
  listTeamRequestGroups,
  parseTeamRequestCity,
  type TeamRequestStatus,
} from "@/lib/team-requests";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const statusRaw = url.searchParams.get("status");
  const status = TEAM_REQUEST_STATUSES.includes(statusRaw as TeamRequestStatus)
    ? (statusRaw as TeamRequestStatus)
    : null;

  const cityRaw = url.searchParams.get("city");
  const city = cityRaw ? parseTeamRequestCity(cityRaw) : null;
  if (cityRaw && cityRaw.trim() && !city) {
    return noStoreJson({ ok: true, page, limit, total: 0, items: [] });
  }

  const { total, items } = listTeamRequestGroups(getDb(), {
    status,
    q: likeQuery(url.searchParams.get("q")),
    citySlug: city?.slug ?? null,
    offset,
    limit,
  });

  return noStoreJson({ ok: true, page, limit, total, items });
}
