import { recordModerationAction } from "./audit";
import {
  mergeModerationResults,
  moderateForumContent,
} from "./engine";
import type {
  ForumModerationContext,
  ForumModerationResult,
  ModerateForumOptions,
  ModerationDecision,
} from "./types";

/** Safe copy for the author. Never includes rule ids or internal reason. */
export const FORUM_CONTENT_BLOCKED_ERROR =
  "Bu içerik topluluk kurallarına uygun olmadığı için yayınlanmadı.";

export const FORUM_CONTENT_REVIEW_ERROR =
  "İçeriğin topluluk kurallarına uygunluk açısından incelenmek üzere beklemeye alındı.";

export type ForumWriteMode = "publish" | "hold" | "none";

export function isPublicForumRow(row: {
  deleted_at: string | null;
  held_at: string | null;
}) {
  return !row.deleted_at && !row.held_at;
}

export function forumWriteMode(decision: ModerationDecision): ForumWriteMode {
  if (decision === "allow") return "publish";
  if (decision === "review") return "hold";
  return "none";
}

export function buildAutoModerationRecord(input: {
  userId: number;
  result: ForumModerationResult;
  targetTopicId?: number | null;
  targetPostId?: number | null;
}) {
  if (input.result.decision === "allow") return null;
  return {
    moderatorUserId: input.userId,
    targetUserId: input.userId,
    targetTopicId: input.targetTopicId ?? null,
    targetPostId: input.targetPostId ?? null,
    action: input.result.decision === "block" ? "auto_block" : "auto_review",
    reason: input.result.reason,
  };
}

export function moderateForumPublication(
  fields: string[],
  context: ForumModerationContext,
  options?: ModerateForumOptions,
): ForumModerationResult {
  return mergeModerationResults(
    fields.map((field) => moderateForumContent(field, context, options)),
  );
}

export function recordAutoModeration(input: {
  userId: number;
  result: ForumModerationResult;
  targetTopicId?: number | null;
  targetPostId?: number | null;
}) {
  const row = buildAutoModerationRecord(input);
  if (!row) return;
  recordModerationAction(row);
}

export function publicModerationError(decision: ModerationDecision) {
  if (decision === "block") return FORUM_CONTENT_BLOCKED_ERROR;
  if (decision === "review") return FORUM_CONTENT_REVIEW_ERROR;
  return null;
}
