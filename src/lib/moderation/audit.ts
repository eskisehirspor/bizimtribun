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
  getDb()
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
}
