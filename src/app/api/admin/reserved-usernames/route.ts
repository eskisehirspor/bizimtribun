import { parseAdminPage, requireAdminResponse } from "@/lib/admin-http";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { listReservedUsernames, reserveUsername } from "@/lib/reserved-usernames";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req, "usernames.manage");
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const { page, limit, offset } = parseAdminPage(url);
  const state = url.searchParams.get("state") === "released" ? "released" : "reserved";
  const q = url.searchParams.get("q")?.trim().slice(0, 40) || null;

  const { total, items } = await listReservedUsernames(getDb(), { q, state, offset, limit });
  return noStoreJson({ ok: true, page, limit, total, items, state });
}

/** Holds a name back, or puts a released one back on hold. */
export async function POST(req: Request) {
  const gate = await requireAdminResponse(req, "usernames.manage");
  if (!gate.ok) return gate.res;

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const data = (body.data ?? {}) as { name?: unknown; note?: unknown };
  if (typeof data.name !== "string") return noStoreJson({ error: "Ad gerekli." }, 400);
  const note = typeof data.note === "string" ? data.note.trim().slice(0, 200) || null : null;

  const db = getDb();
  const result = await reserveUsername(db, data.name, note);
  if (!result.ok) return noStoreJson({ error: result.error }, 400);
  await writeAudit(db, {
    actorUserId: gate.user.id,
    action: "username.reserve",
    targetType: "username",
    targetId: result.name,
    reason: note,
  });
  return noStoreJson({ ok: true, name: result.name });
}
