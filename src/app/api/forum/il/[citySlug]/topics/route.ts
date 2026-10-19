import { boardTopicsGet, boardTopicsPost, resolveCityBoard } from "@/lib/forum-board-http";

export async function GET(req: Request, ctx: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await ctx.params;
  return boardTopicsGet(req, resolveCityBoard(citySlug));
}

export async function POST(req: Request, ctx: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await ctx.params;
  return boardTopicsPost(req, resolveCityBoard(citySlug));
}
