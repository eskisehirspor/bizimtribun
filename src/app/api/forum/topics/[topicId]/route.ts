import { z } from "zod";
import { isBrowserSameSite } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import { FORUM_BODY_MAX, FORUM_TITLE_MAX, FORUM_TITLE_MIN } from "@/lib/policy";
import { parseForumCategoryInput } from "@/lib/forum-category";
import {
  cleanForumText,
  cleanForumTitle,
  findLiveTopic,
  listPosts,
  parseIdParam,
  parsePageLimit,
  requireForumBoard,
  serializeTopic,
  softDeleteTopic,
  updateTopic,
} from "@/lib/forum";
import {
  FORUM_CONTENT_BLOCKED_ERROR,
  FORUM_CONTENT_REVIEW_ERROR,
  forumWriteMode,
  moderateForumPublication,
  recordAutoModeration,
} from "@/lib/moderation";

const UpdateBody = z.object({
  title: z.string().min(FORUM_TITLE_MIN).max(FORUM_TITLE_MAX),
  content: z.string().min(1).max(FORUM_BODY_MAX),
  category: z.unknown().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const { topicId: raw } = await ctx.params;
  const topicId = parseIdParam(raw);
  if (topicId == null) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }

  const topic = findLiveTopic(topicId);
  if (!topic || !requireForumBoard(topic.team_id)) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }

  const { page, limit, offset } = parsePageLimit(new URL(req.url));
  const { total, posts } = listPosts(topic.id, offset, limit);
  return noStoreJson({
    ok: true,
    topic: serializeTopic(topic),
    page,
    limit,
    total,
    posts,
  });
}

export async function PUT(
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
  if (topic.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu konuyu düzenleyemezsin." }, 403);
  }

  const parsed = UpdateBody.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Başlık ve yazı gerekli." }, 400);
  }
  const title = cleanForumTitle(parsed.data.title);
  const content = cleanForumText(parsed.data.content, FORUM_BODY_MAX);
  if (!title || !content) {
    return noStoreJson(
      { error: "Başlık veya yazı boş olamaz. Limitleri aşma." },
      400,
    );
  }
  const cat = parseForumCategoryInput(parsed.data.category, null);
  if (!cat.ok) {
    return noStoreJson({ error: "Geçersiz kategori." }, 400);
  }

  const verdict = moderateForumPublication([title, content], {
    surface: "topic",
    field: "body",
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

  if (
    !updateTopic(topic.id, active.user.id, {
      title,
      content,
      category: cat.category ?? undefined,
      holdForReview: mode === "hold",
    })
  ) {
    return noStoreJson({ error: "Konu güncellenemedi." }, 409);
  }
  if (mode === "hold") {
    recordAutoModeration({
      userId: active.user.id,
      result: verdict,
      targetTopicId: topic.id,
    });
    return noStoreJson({ error: FORUM_CONTENT_REVIEW_ERROR }, 422);
  }
  return noStoreJson({
    ok: true,
    topic: serializeTopic(findLiveTopic(topic.id)!),
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

  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  const topic = findLiveTopic(topicId);
  if (!topic || !requireForumBoard(topic.team_id)) {
    return noStoreJson({ error: "Konu bulunamadı." }, 404);
  }
  if (topic.user_id !== active.user.id) {
    return noStoreJson({ error: "Bu konuyu silemezsin." }, 403);
  }

  if (!softDeleteTopic(topic.id, active.user.id)) {
    return noStoreJson({ error: "Konu silinemedi." }, 409);
  }
  return noStoreJson({ ok: true });
}
