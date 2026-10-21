import { boardTopicsGet, boardTopicsPost, resolveGeneralBoard } from "@/lib/forum-board-http";

export async function GET(req: Request) {
  return boardTopicsGet(req, resolveGeneralBoard());
}

export async function POST(req: Request) {
  return boardTopicsPost(req, resolveGeneralBoard());
}
