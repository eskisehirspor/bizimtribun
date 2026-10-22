import { getDb } from "./db";
import { getSettings } from "./site-settings";

export type RecentTopic = {
  id: number;
  title: string;
  teamId: string | null;
  board: "team" | "general" | "city";
  province: string | null;
  authorUsername: string;
  createdAt: string;
};

/**
 * Public, live topics on boards that are open right now. Team tribunes are
 * members-only, so their topics never appear on the shared home page.
 */
async function openBoardSql() {
  const { features } = await getSettings();
  return `t.deleted_at IS NULL AND t.held_at IS NULL
    AND (
      FALSE
      ${features.generalBoardOpen ? "OR t.board = 'general'" : ""}
    )`;
}

const COLUMNS = `t.id, t.title, t.team_id as teamId, t.board, t.city as province, u.username as authorUsername,
  t.created_at as createdAt`;

/** Latest public forum topics, shown as real community activity on the home page. */
export async function recentPublicTopics(limit = 8): Promise<RecentTopic[]> {
  return await getDb()
      .prepare(
        `SELECT ${COLUMNS}
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE ${await openBoardSql()} AND t.is_pinned = 0
       ORDER BY t.id DESC
       LIMIT ?`,
      )
      .all(Math.min(Math.max(limit, 1), 20)) as RecentTopic[];
}

/** Topics an admin chose to feature, in the chosen order; removed ones drop out. */
export async function featuredPublicTopics(ids: number[]): Promise<RecentTopic[]> {
  if (ids.length === 0) return [];
  const rows = await getDb()
      .prepare(
        `SELECT ${COLUMNS}
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE ${await openBoardSql()} AND t.id IN (${ids.map(() => "?").join(", ")})`,
      )
      .all(...ids) as RecentTopic[];
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is RecentTopic => Boolean(r));
}
