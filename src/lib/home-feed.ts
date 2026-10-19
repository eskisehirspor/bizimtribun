import { getDb } from "./db";

export type RecentTopic = {
  id: number;
  title: string;
  teamId: string | null;
  board: "team" | "general" | "city";
  province: string | null;
  authorUsername: string;
  createdAt: string;
};

/** Latest public forum topics, shown as real community activity on the home page. */
export function recentPublicTopics(limit = 8): RecentTopic[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.title, t.team_id as teamId, t.board, t.city as province, u.username as authorUsername,
              t.created_at as createdAt
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE t.deleted_at IS NULL AND t.held_at IS NULL AND t.is_pinned = 0
       ORDER BY t.id DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 20)) as RecentTopic[];
}
