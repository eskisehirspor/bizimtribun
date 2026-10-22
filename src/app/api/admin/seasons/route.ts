import { z } from "zod";
import { requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { createSeason } from "@/lib/team-admin";

const Body = z.object({
  label: z.string().max(20),
  startsOn: z.string(),
  endsOn: z.string(),
  makeCurrent: z.boolean().default(false),
});

export async function POST(req: Request) {
  const gate = await requireAdminResponse(req, "teams.manage");
  if (!gate.ok) return gate.res;
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const result = await createSeason(getDb(), gate.user.id, parsed.data);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true, id: result.id });
}
