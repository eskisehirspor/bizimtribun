import { getDb } from "./db";
import { memberTeamId, visibleBoardSql, type BoardViewer } from "./forum";
import { isStaffRole } from "./permissions";

export type TeamBoardSummary = {
  teamId: string;
  total: number;
  lastTitle: string | null;
  lastAt: string | null;
};

/**
 * Topic counts for the team tribunes this viewer may read. Boards the viewer
 * can't open are left out entirely, so nothing about them leaks (not even a count).
 * Uses the same visibility filter as every other mixed-board list.
 */
export function teamBoardSummaries(viewer: BoardViewer) {
  const vis = visibleBoardSql("t", viewer);
  const rows = getDb()
    .prepare(
      `SELECT t.team_id as teamId, COUNT(*) as total, MAX(t.updated_at) as lastAt,
              (SELECT t2.title FROM forum_topics t2
               WHERE t2.board = 'team' AND t2.team_id = t.team_id
                 AND t2.deleted_at IS NULL AND t2.held_at IS NULL
               ORDER BY t2.updated_at DESC LIMIT 1) as lastTitle
       FROM forum_topics t
       JOIN teams tm ON tm.id = t.team_id AND tm.is_forum_active = 1
       WHERE t.board = 'team' AND t.deleted_at IS NULL AND t.held_at IS NULL ${vis.sql}
       GROUP BY t.team_id`,
    )
    .all(...vis.params) as TeamBoardSummary[];
  return {
    myTeamId: viewer ? memberTeamId(viewer.id) : null,
    staff: Boolean(viewer && isStaffRole(viewer.role)),
    boards: rows,
  };
}
