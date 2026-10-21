import { boardTopicsGet, boardTopicsPost, resolveTeamBoard } from "@/lib/forum-board-http";

export async function GET(req: Request, ctx: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await ctx.params;
  return boardTopicsGet(req, resolveTeamBoard(teamSlug));
}

export async function POST(req: Request, ctx: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await ctx.params;
  return boardTopicsPost(req, resolveTeamBoard(teamSlug));
}
