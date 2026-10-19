import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { runHousekeepingIfDue } from "@/lib/housekeeping";
import { noStoreJson } from "@/lib/http";
import { listNotifications, unreadCount } from "@/lib/notifications";

export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const db = getDb();
  runHousekeepingIfDue(db);
  const url = new URL(req.url);
  const unread = unreadCount(db, active.user.id);
  if (url.searchParams.get("count") === "1") return noStoreJson({ ok: true, unread });
  const before = Number(url.searchParams.get("before")) || undefined;
  return noStoreJson({
    ok: true,
    unread,
    items: listNotifications(db, active.user.id, 30, before),
  });
}
