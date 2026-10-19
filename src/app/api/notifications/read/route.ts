import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { markRead, unreadCount } from "@/lib/notifications";

const Body = z.object({ ids: z.union([z.literal("all"), z.array(z.number().int().positive()).max(100)]) });

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const db = getDb();
  markRead(db, active.user.id, parsed.data.ids);
  return noStoreJson({ ok: true, unread: unreadCount(db, active.user.id) });
}
