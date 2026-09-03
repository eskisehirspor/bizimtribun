import { z } from "zod";
import { clientIp } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import { FORUM_POST_MAX } from "@/lib/policy";
import {
  cleanForumText,
  createPost,
  findLiveTopic,
  forumPostLimited,
  noteForumPostAttempt,
  parseIdParam,
  requireForumBoard,
  serializePost,
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const { topicId: raw } = await ctx.params;
  const topicId = parseIdParam(raw);
  if (topicId == null) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }

  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  const topic = findLiveTopic(topicId);
  if (!topic || !requireForumBoard(topic.team_id)) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }
  if (topic.locked_at) {
    return noStoreJson({ error: "Bu konu kilitli. Yorum eklenemez." }, 409);
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
    });
    return noStoreJson({ error: FORUM_CONTENT_BLOCKED_ERROR }, 422);
  }

  const ip = await clientIp();
  if (forumPostLimited(ip, active.user.id)) {
    return noStoreJson({ error: "Çok fazla yorum. Biraz sonra dene." }, 429);
  }
  noteForumPostAttempt(ip, active.user.id);

  const post = createPost({
    topicId: topic.id,
    userId: active.user.id,
    content,
    holdForReview: mode === "hold",
  });
  if (mode === "hold") {
    recordAutoModeration({
      userId: active.user.id,
      result: verdict,
      targetTopicId: topic.id,
      targetPostId: post.id,
    });
    return noStoreJson({ error: FORUM_CONTENT_REVIEW_ERROR }, 422);
  }
  return noStoreJson({ ok: true, post: serializePost(post) }, 201);
}
