import { z } from "zod";
import { getSessionUser, requireForumWriter } from "./auth";
import { forumFloodCheck, isNewAccount } from "./forum-spam";
import {
  boardAccess,
  cleanForumText,
  cleanForumTitle,
  createTopic,
  forumTopicLimited,
  listTopics,
  noteForumTopicAttempt,
  parsePageLimit,
  requireForumBoard,
  serializeTopic,
  type ForumBoardRef,
} from "./forum";
import {
  FORUM_CATEGORY_DEFAULT,
  parseForumCategoryInput,
  parseForumCategoryParam,
  parseTopicSort,
} from "./forum-category";
import { noStoreJson, readJsonBody } from "./http";
import {
  FORUM_CONTENT_BLOCKED_ERROR,
  FORUM_CONTENT_REVIEW_ERROR,
  forumWriteMode,
  moderateForumPublication,
  recordAutoModeration,
} from "./moderation";
import { FORUM_BODY_MAX, FORUM_TITLE_MAX, FORUM_TITLE_MIN } from "./policy";
import { clientIp } from "./request";
import { getDb } from "./db";
import { getSettings } from "./site-settings";
import { refreshBadges } from "./profiles";
import { notifyStaffNewTopic } from "./notifications";

/**
 * One topic list/create implementation for every board: team tribunes,
 * the Milli Takım Tribünü. Only how the board is resolved
 * differs between the routes.
 */
export type ResolvedBoard = {
  ref: ForumBoardRef;
  /** Public description of the board for the client. */
  info: Record<string, string | null>;
};

export function resolveTeamBoard(teamSlug: string): ResolvedBoard | null {
  const team = requireForumBoard(teamSlug);
  if (!team) return null;
  return {
    ref: { kind: "team", teamId: team.id },
    info: { kind: "team", id: team.id, name: team.name, league: team.league },
  };
}

export function resolveGeneralBoard(): ResolvedBoard | null {
  if (!getSettings().features.generalBoardOpen) return null;
  return { ref: { kind: "general" }, info: { kind: "general", id: "genel", name: "Milli Takım Tribünü" } };
}

const CreateBody = z.object({
  title: z.string().min(FORUM_TITLE_MIN).max(FORUM_TITLE_MAX),
  content: z.string().min(1).max(FORUM_BODY_MAX),
  category: z.unknown().optional(),
});

export async function boardTopicsGet(req: Request, board: ResolvedBoard | null) {
  if (!board) return noStoreJson({ error: "Bu tribünde forum yok." }, 404);
  const url = new URL(req.url);
  const { page, limit, offset } = parsePageLimit(url);
  const parsedCat = parseForumCategoryParam(url.searchParams.get("category"));
  if (!parsedCat.ok) return noStoreJson({ error: "Geçersiz kategori." }, 400);
  const sort = parseTopicSort(url.searchParams.get("sort"));
  const viewer = await getSessionUser(req);
  const access = boardAccess(board.ref, viewer);
  if (!access.ok) return noStoreJson({ error: access.error, code: access.code, board: board.info }, access.status);
  const { total, topics } = listTopics(board.ref, offset, limit, {
    category: parsedCat.category,
    sort,
    viewerId: viewer?.id ?? null,
  });
  return noStoreJson({
    ok: true,
    board: board.info,
    team: board.ref.kind === "team" ? board.info : undefined,
    page,
    limit,
    total,
    topics,
  });
}

export async function boardTopicsPost(req: Request, board: ResolvedBoard | null) {
  if (!board) return noStoreJson({ error: "Bu tribünde forum yok." }, 404);

  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);

  const active = requireForumWriter(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const access = boardAccess(board.ref, active.user, "write");
  if (!access.ok) return noStoreJson({ error: access.error, code: access.code }, access.status);

  const parsed = CreateBody.safeParse(body.data);
  if (!parsed.success) return noStoreJson({ error: "Başlık ve yazı gerekli." }, 400);
  const title = cleanForumTitle(parsed.data.title);
  const content = cleanForumText(parsed.data.content, FORUM_BODY_MAX);
  if (!title || !content) {
    return noStoreJson({ error: "Başlık veya yazı boş olamaz. Limitleri aşma." }, 400);
  }
  const cat = parseForumCategoryInput(parsed.data.category, FORUM_CATEGORY_DEFAULT);
  if (!cat.ok) return noStoreJson({ error: "Geçersiz kategori." }, 400);

  // Counted before moderation so blocked attempts can't probe the filter for free.
  const ip = await clientIp();
  if (forumTopicLimited(ip, active.user.id)) {
    return noStoreJson({ error: "Çok fazla konu açtın. Biraz sonra dene." }, 429);
  }
  noteForumTopicAttempt(ip, active.user.id);
  const flood = forumFloodCheck(getDb(), active.user.id, content);
  if (!flood.ok) return noStoreJson({ error: flood.error }, flood.status);

  const verdict = moderateForumPublication([title, content], {
    surface: "topic",
    userId: active.user.id,
    teamId: board.ref.kind === "team" ? board.ref.teamId : undefined,
    newAccount: isNewAccount(getDb(), active.user.id),
  });
  const mode = forumWriteMode(verdict.decision);
  if (mode === "none") {
    recordAutoModeration({ userId: active.user.id, result: verdict });
    return noStoreJson({ error: FORUM_CONTENT_BLOCKED_ERROR }, 422);
  }

  const topic = createTopic({
    board: board.ref,
    userId: active.user.id,
    title,
    content,
    category: cat.category ?? FORUM_CATEGORY_DEFAULT,
    holdForReview: mode === "hold",
  });
  notifyStaffNewTopic(getDb(), {
    actorId: active.user.id,
    topicId: topic.id,
    title,
    boardName: String(board.info.name ?? "forum"),
    held: mode === "hold",
  });
  if (mode === "hold") {
    recordAutoModeration({ userId: active.user.id, result: verdict, targetTopicId: topic.id });
    return noStoreJson({ error: FORUM_CONTENT_REVIEW_ERROR }, 422);
  }
  refreshBadges(getDb(), active.user.id);
  return noStoreJson({ ok: true, topic: serializeTopic(topic, active.user.id) }, 201);
}
