import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { blockUser, listBlocks } from "@/lib/forum-social";
import { noStoreJson, readJsonBody } from "@/lib/http";

const Body = z.object({ userId: z.number().int().positive(), blocked: z.boolean() });

export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({ ok: true, blocks: listBlocks(getDb(), active.user.id) });
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const result = blockUser(getDb(), active.user.id, parsed.data.userId, parsed.data.blocked);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true, blocked: parsed.data.blocked });
}
