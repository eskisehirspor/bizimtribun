import { requireAdminResponse } from "@/lib/admin-http";
import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { releaseReservedUsername } from "@/lib/reserved-usernames";

/** Frees a reserved name so the next person to sign up can take it. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const gate = await requireAdminResponse(req, "usernames.manage");
  if (!gate.ok) return gate.res;

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const reasonRaw = (body.data as { reason?: unknown } | null)?.reason;
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, 500) || null : null;

  const name = (await ctx.params).name;
  const db = getDb();
  if (!(await releaseReservedUsername(db, name, gate.user.id))) {
    return noStoreJson({ error: "Bu ad zaten serbest ya da listede yok." }, 404);
  }
  await writeAudit(db, {
    actorUserId: gate.user.id,
    action: "username.release",
    targetType: "username",
    targetId: name,
    reason,
  });
  return noStoreJson({ ok: true });
}
