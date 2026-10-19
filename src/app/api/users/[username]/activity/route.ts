import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { getPublicProfile, listProfileActivity } from "@/lib/profiles";

const PAGE = 20;

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const viewer = await getSessionUser(req);
  const db = getDb();
  const found = getPublicProfile(db, username, { signedIn: Boolean(viewer) });
  if (!found.ok) return noStoreJson({ error: found.error }, found.status);
  const page = Math.max(1, Math.min(500, Number(new URL(req.url).searchParams.get("page")) || 1));
  const items = listProfileActivity(db, found.profile.id, (page - 1) * PAGE, PAGE + 1);
  return noStoreJson({ ok: true, page, hasMore: items.length > PAGE, items: items.slice(0, PAGE) });
}
