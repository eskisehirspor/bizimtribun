import { isBrowserSameSite } from "@/lib/request";
import { noStoreJson } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import {
  findLiveTopic,
  listPosts,
  parseIdParam,
  parsePageLimit,
  topicAccess,
  topicBoardOpen,
  serializeTopic,
  softDeleteTopic,
} from "@/lib/forum";

// Topics can't be edited once published, only deleted by their author.

export async function GET(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const { topicId: raw } = await ctx.params;
  const topicId = parseIdParam(raw);
  if (topicId == null) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }

  const topic = await findLiveTopic(topicId);
  if (!topic || !await topicBoardOpen(topic)) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }
  const viewer = await getSessionUser(req);
  const access = await topicAccess(topic, viewer);
  if (!access.ok) {
    return noStoreJson({ error: access.error, code: access.code }, access.status);
  }

  const { page, limit, offset } = parsePageLimit(new URL(req.url));
  const viewerId = viewer?.id ?? null;
  const { total, posts } = await listPosts(topic.id, offset, limit, viewerId);
  return noStoreJson({
    ok: true,
    topic: await serializeTopic(topic, viewerId),
    page,
    limit,
    total,
    posts,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const { topicId: raw } = await ctx.params;
  const topicId = parseIdParam(raw);
  if (topicId == null) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }

  if (!isBrowserSameSite(req)) {
    return noStoreJson({ error: "Geçersiz kaynak." }, 400);
  }

  const active = await requireForumWriter(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  const topic = await findLiveTopic(topicId);
  if (!topic || !await topicBoardOpen(topic)) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }
  const access = await topicAccess(topic, active.user, "write");
  if (!access.ok) {
    return noStoreJson({ error: access.error, code: access.code }, access.status);
  }
  if (topic.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu konuyu silemezsin." }, 403);
  }

  if (!await softDeleteTopic(topic.id, active.user.id)) {
    return noStoreJson({ error: "Konu silinemedi." }, 409);
  }
  return noStoreJson({ ok: true });
}
