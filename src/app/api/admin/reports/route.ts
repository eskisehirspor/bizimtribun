import { parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { listReports } from "@/lib/forum-social";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req, "forum.moderate");
  if (!gate.ok) return gate.res;
  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const status = url.searchParams.get("status") === "closed" ? "closed" : "open";
  const { total, items } = await listReports(getDb(), { status, limit, offset });
  return noStoreJson({ ok: true, page, limit, total, items, status });
}
