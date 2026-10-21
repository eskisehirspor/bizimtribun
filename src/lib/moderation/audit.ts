import { writeAudit } from "../audit";
import { getDb } from "../db";

export type ModerationActionInput = {
  moderatorUserId: number;
  action: string;
  reason?: string | null;
  targetUserId?: number | null;
  targetTopicId?: number | null;
  targetPostId?: number | null;
};

export function recordModerationAction(input: ModerationActionInput) {
  const action = input.action.trim().slice(0, 64);
  if (!action) {
    throw new Error("moderation action required");
  }
  const reason = input.reason?.trim().slice(0, 500) || null;
  const db = getDb();
  db
    .prepare(
      `INSERT INTO moderation_actions
       (moderator_user_id, target_user_id, target_topic_id, target_post_id, action, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.moderatorUserId,
      input.targetUserId ?? null,
      input.targetTopicId ?? null,
      input.targetPostId ?? null,
      action,
      reason,
      new Date().toISOString(),
    );

  const target =
    input.targetPostId != null
      ? { type: "post", id: input.targetPostId }
      : input.targetTopicId != null
        ? { type: "topic", id: input.targetTopicId }
        : input.targetUserId != null
          ? { type: "user", id: input.targetUserId }
          : null;
  writeAudit(db, {
    actorUserId: input.moderatorUserId,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    reason,
    meta:
      input.targetUserId != null && target?.type !== "user"
        ? { targetUserId: input.targetUserId }
        : undefined,
  });
}
