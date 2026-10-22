import { boardTopicsGet, boardTopicsPost, resolveGeneralBoard } from "@/lib/forum-board-http";

export async function GET(req: Request) {
  return boardTopicsGet(req, await resolveGeneralBoard());
}

export async function POST(req: Request) {
  return boardTopicsPost(req, await resolveGeneralBoard());
}
