import { isBrowserSameSite } from "@/lib/request";
import { noStoreJson } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import {
  findLivePost,
  findLiveTopic,
  parseIdParam,
  topicAccess,
  topicBoardOpen,
  softDeletePost,
} from "@/lib/forum";

// Replies can't be edited once published, only deleted by their author.

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ postId: string }> },
) {
  const { postId: raw } = await ctx.params;
  const postId = parseIdParam(raw);
  if (postId == null) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }

  if (!isBrowserSameSite(req)) {
    return noStoreJson({ error: "Geçersiz kaynak." }, 400);
  }

  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  const post = findLivePost(postId);
  if (!post) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }
  const topic = findLiveTopic(post.topic_id);
  if (!topic || !topicBoardOpen(topic)) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }
  const access = topicAccess(topic, active.user, "write");
  if (!access.ok) {
    return noStoreJson({ error: access.error, code: access.code }, access.status);
  }
  if (post.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu yazıyı silemezsin." }, 403);
  }

  if (!softDeletePost(post.id, active.user.id)) {
    return noStoreJson({ error: "Yazı silinemedi." }, 409);
  }
  return noStoreJson({ ok: true });
}
