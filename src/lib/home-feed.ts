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

/** Public, live topics on boards that are open right now. */
function openBoardSql() {
  const { features } = getSettings();
  return `t.deleted_at IS NULL AND t.held_at IS NULL
    AND (
      (t.board = 'team' AND EXISTS (SELECT 1 FROM teams tm WHERE tm.id = t.team_id AND tm.is_forum_active = 1))
      ${features.generalBoardOpen ? "OR t.board = 'general'" : ""}
      ${features.cityBoardsOpen ? "OR t.board = 'city'" : ""}
    )`;
}

const COLUMNS = `t.id, t.title, t.team_id as teamId, t.board, t.city as province, u.username as authorUsername,
  t.created_at as createdAt`;

/** Latest public forum topics, shown as real community activity on the home page. */
export function recentPublicTopics(limit = 8): RecentTopic[] {
  return getDb()
    .prepare(
      `SELECT ${COLUMNS}
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE ${openBoardSql()} AND t.is_pinned = 0
       ORDER BY t.id DESC
       LIMIT ?`,
    )
    .all(Math.min(Math.max(limit, 1), 20)) as RecentTopic[];
}

/** Topics an admin chose to feature, in the chosen order; removed ones drop out. */
export function featuredPublicTopics(ids: number[]): RecentTopic[] {
  if (ids.length === 0) return [];
  const rows = getDb()
    .prepare(
      `SELECT ${COLUMNS}
       FROM forum_topics t
       JOIN users u ON u.id = t.user_id
       WHERE ${openBoardSql()} AND t.id IN (${ids.map(() => "?").join(", ")})`,
    )
    .all(...ids) as RecentTopic[];
  return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is RecentTopic => Boolean(r));
}
