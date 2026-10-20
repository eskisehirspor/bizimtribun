import { getSessionUser } from "@/lib/auth";
import { teamBoardSummaries } from "@/lib/forum-summary";
import { noStoreJson } from "@/lib/http";

/** Read-only: topic counts for the team tribunes the viewer is allowed to read. */
export async function GET(req: Request) {
  const viewer = await getSessionUser(req);
  return noStoreJson({ ok: true, ...teamBoardSummaries(viewer) });
}
