import { noStoreJson } from "@/lib/http";
import { getForumLeaderHistory, requireForumBoard } from "@/lib/forum";
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
  }));

  return noStoreJson({
    ok: true,
    team: { id: team.id, name: team.name },
    leaders,
  });
}
