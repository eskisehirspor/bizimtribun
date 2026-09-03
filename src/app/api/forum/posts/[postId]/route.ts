import { z } from "zod";
import { isBrowserSameSite } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import { FORUM_POST_MAX } from "@/lib/policy";
import {
  cleanForumText,
  findLivePost,
  findLiveTopic,
  parseIdParam,
  requireForumBoard,
  serializePost,
  softDeletePost,
  updatePost,
} from "@/lib/forum";
import {
  FORUM_CONTENT_BLOCKED_ERROR,
  FORUM_CONTENT_REVIEW_ERROR,
  forumWriteMode,
  moderateForumPublication,
  recordAutoModeration,
} from "@/lib/moderation";

const Body = z.object({
  content: z.string().min(1).max(FORUM_POST_MAX),
});

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ postId: string }> },
) {
  const { postId: raw } = await ctx.params;
  const postId = parseIdParam(raw);
  if (postId == null) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }

  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
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
  if (!topic || !requireForumBoard(topic.team_id)) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }
  if (post.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu yazıyı düzenleyemezsin." }, 403);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Yazı gerekli." }, 400);
  }
  const content = cleanForumText(parsed.data.content, FORUM_POST_MAX);
  if (!content) {
    return noStoreJson({ error: "Yazı boş olamaz. Limitleri aşma." }, 400);
  }

  const verdict = moderateForumPublication([content], {
    surface: "post",
    userId: active.user.id,
    teamId: topic.team_id,
    topicId: topic.id,
  });
  const mode = forumWriteMode(verdict.decision);
  if (mode === "none") {
    recordAutoModeration({
      userId: active.user.id,
      result: verdict,
      targetTopicId: topic.id,
      targetPostId: post.id,
    });
    return noStoreJson({ error: FORUM_CONTENT_BLOCKED_ERROR }, 422);
  }

  if (!updatePost(post.id, active.user.id, content, mode === "hold")) {
    return noStoreJson({ error: "Yazı güncellenemedi." }, 409);
  }
  if (mode === "hold") {
    recordAutoModeration({
      userId: active.user.id,
      result: verdict,
      targetTopicId: topic.id,
      targetPostId: post.id,
    });
    return noStoreJson({ error: FORUM_CONTENT_REVIEW_ERROR }, 422);
  }
  const updated = findLivePost(post.id)!;
  return noStoreJson({ ok: true, post: serializePost(updated) });
}

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
  if (!topic || !requireForumBoard(topic.team_id)) {
    return noStoreJson({ error: "Yazı bulunamadı." }, 404);
  }
  if (post.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu yazıyı silemezsin." }, 403);
  }

  if (!softDeletePost(post.id, active.user.id)) {
    return noStoreJson({ error: "Yazı silinemedi." }, 409);
  }
  return noStoreJson({ ok: true });
}
