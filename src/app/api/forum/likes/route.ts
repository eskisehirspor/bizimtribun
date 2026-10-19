import { z } from "zod";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { setLike } from "@/lib/forum-social";
import { refreshBadges } from "@/lib/profiles";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { notifyLike } from "@/lib/notifications";
import { getSettings } from "@/lib/site-settings";

const Body = z.object({
  type: z.enum(["topic", "post"]),
  id: z.number().int().positive(),
  liked: z.boolean(),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  if (!getSettings().features.likesEnabled) return noStoreJson({ error: "Beğeniler şu an kapalı." }, 403);

  const db = getDb();
  const result = setLike(db, active.user.id, parsed.data.type, parsed.data.id, parsed.data.liked);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  if (result.created) {
    notifyLike(db, {
      actorId: active.user.id,
      recipientId: result.authorId,
      type: parsed.data.type,
      id: parsed.data.id,
    });
    refreshBadges(db, result.authorId);
  }
  return noStoreJson({ ok: true, likeCount: result.likeCount, likedByMe: result.likedByMe });
}
