import { z } from "zod";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import {
  AVATARS,
  PROFILE_BIO_MAX,
  PROFILE_DISPLAY_NAME_MAX,
  getProfileSettings,
  updateProfileSettings,
} from "@/lib/profiles";

// Strict: unknown keys (role, team, username, status…) are rejected outright.
const Body = z
  .object({
    displayName: z.string().max(PROFILE_DISPLAY_NAME_MAX * 2),
    bio: z.string().max(PROFILE_BIO_MAX * 2),
    avatar: z.enum(AVATARS).nullable(),
    visibility: z.enum(["members", "public"]),
    showCity: z.boolean(),
    notifyReplies: z.boolean(),
    notifyMentions: z.boolean(),
    notifyLikes: z.boolean(),
    notifyNewTopics: z.boolean().nullable(),
  })
  .partial()
  .strict();

export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({ ok: true, settings: await getProfileSettings(getDb(), active.user.id) });
}

export async function PATCH(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Geçersiz istek." }, 400);
  const result = await updateProfileSettings(getDb(), active.user.id, parsed.data);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true, settings: result.settings });
}
