import { noStoreJson } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { boardAccess, getForumLeaderHistory, requireForumBoard } from "@/lib/forum";
import { formatForumLeaderPeriod } from "@/lib/forum-leaders";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamSlug: string }> },
) {
  const { teamSlug } = await ctx.params;
  const team = requireForumBoard(teamSlug);
  if (!team) {
    return noStoreJson({ error: "Bu tribünde forum yok." }, 404);
  }
  // Leaders are people active in a members-only tribune.
  const access = boardAccess({ kind: "team", teamId: team.id }, await getSessionUser(req));
  if (!access.ok) return noStoreJson({ error: access.error, code: access.code }, access.status);

  const n = Number(new URL(req.url).searchParams.get("limit") || 12);
  const limit = Math.min(36, Math.max(1, Number.isFinite(n) ? n : 12));
  const leaders = getForumLeaderHistory(team.id, limit).map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    year: row.year,
    month: row.month,
    period: formatForumLeaderPeriod(row.year, row.month),
    username: row.username,
    postCount: row.postCount,
    activeDays: row.activeDays,
    likeCount: row.likeCount,
  }));

  return noStoreJson({
    ok: true,
    team: { id: team.id, name: team.name },
    leaders,
  });
}
