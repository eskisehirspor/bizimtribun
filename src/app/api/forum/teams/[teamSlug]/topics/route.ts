import { z } from "zod";
import { clientIp } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireForumWriter } from "@/lib/auth";
import {
  FORUM_BODY_MAX,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
} from "@/lib/policy";
import {
  FORUM_CATEGORY_DEFAULT,
  parseForumCategoryInput,
  parseForumCategoryParam,
  parseTopicSort,
} from "@/lib/forum-category";
import {
  cleanForumText,
  cleanForumTitle,
  createTopic,
  forumTopicLimited,
  listTopics,
  noteForumTopicAttempt,
  parsePageLimit,
  requireForumBoard,
  serializeTopic,
} from "@/lib/forum";
import {
  FORUM_CONTENT_BLOCKED_ERROR,
  FORUM_CONTENT_REVIEW_ERROR,
  forumWriteMode,
  moderateForumPublication,
  recordAutoModeration,
} from "@/lib/moderation";

const CreateBody = z.object({
  title: z.string().min(FORUM_TITLE_MIN).max(FORUM_TITLE_MAX),
  content: z.string().min(1).max(FORUM_BODY_MAX),
  category: z.unknown().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamSlug: string }> },
) {
  const { teamSlug } = await ctx.params;
  const team = requireForumBoard(teamSlug);
  if (!team) {
    return noStoreJson({ error: "Bu tribünde forum yok." }, 404);
  }

  const url = new URL(req.url);
  const { page, limit, offset } = parsePageLimit(url);
  const parsedCat = parseForumCategoryParam(url.searchParams.get("category"));
  if (!parsedCat.ok) {
    return noStoreJson({ error: "Geçersiz kategori." }, 400);
  }
  const sort = parseTopicSort(url.searchParams.get("sort"));
  const { total, topics } = listTopics(team.id, offset, limit, {
    category: parsedCat.category,
    sort,
  });
  return noStoreJson({
    ok: true,
    team: { id: team.id, name: team.name, league: team.league },
    page,
    limit,
    total,
    topics,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ teamSlug: string }> },
) {
  const { teamSlug } = await ctx.params;
  const team = requireForumBoard(teamSlug);
  if (!team) {
    return noStoreJson({ error: "Bu tribünde forum yok." }, 404);
  }

  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }

  const parsed = CreateBody.safeParse(body.data);
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
  const cat = parseForumCategoryInput(
    parsed.data.category,
    FORUM_CATEGORY_DEFAULT,
  );
  if (!cat.ok) {
    return noStoreJson({ error: "Geçersiz kategori." }, 400);
  }

  const verdict = moderateForumPublication([title, content], {
    surface: "topic",
    userId: active.user.id,
    teamId: team.id,
  });
  const mode = forumWriteMode(verdict.decision);
  if (mode === "none") {
    recordAutoModeration({ userId: active.user.id, result: verdict });
    return noStoreJson({ error: FORUM_CONTENT_BLOCKED_ERROR }, 422);
  }

  const ip = await clientIp();
  if (forumTopicLimited(ip, active.user.id)) {
    return noStoreJson({ error: "Çok fazla konu açtın. Biraz sonra dene." }, 429);
  }
  noteForumTopicAttempt(ip, active.user.id);

  const topic = createTopic({
    teamId: team.id,
    userId: active.user.id,
    title,
    content,
    category: cat.category ?? FORUM_CATEGORY_DEFAULT,
    holdForReview: mode === "hold",
  });
  if (mode === "hold") {
    recordAutoModeration({
      userId: active.user.id,
      result: verdict,
      targetTopicId: topic.id,
    });
    return noStoreJson({ error: FORUM_CONTENT_REVIEW_ERROR }, 422);
  }
  return noStoreJson({ ok: true, topic: serializeTopic(topic) }, 201);
}
