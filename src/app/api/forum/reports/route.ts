import { z } from "zod";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { REPORT_REASONS, fileReport } from "@/lib/forum-social";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({
  type: z.enum(["topic", "post", "user"]),
  id: z.number().int().positive(),
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Bir sebep seç." }, 400);
  const result = fileReport(getDb(), active.user.id, parsed.data);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true }, 201);
}
