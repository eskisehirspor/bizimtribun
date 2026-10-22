import { noStoreJson } from "@/lib/http";
import {
  clearSessionCookie,
  getSessionUser,
  readSessionToken,
  requireActiveUser,
  revokeSessionByToken,
} from "@/lib/auth";
import { isUserBanned } from "@/lib/users";
import { getDb } from "@/lib/db";
import { findFanVote } from "@/lib/fan-votes";
import { pendingLegalDocs } from "@/lib/legal";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return noStoreJson({ ok: true, user: null });
  }
  if (isUserBanned(user)) {
    await revokeSessionByToken(await readSessionToken(req));
    const res = noStoreJson(
      { ok: false, user: null, error: "Hesap askıya alınmış." },
      403,
    );
    return clearSessionCookie(res);
  }
  const active = requireActiveUser(user);
  if (!active.ok) {
    return noStoreJson({ ok: false, user: null, error: active.error }, active.status);
  }
  const db = getDb();
  const vote = await findFanVote(db, active.user.id);
  return noStoreJson({
    ok: true,
    user: { ...active.publicUser, voteTeamId: vote?.team_id ?? null },
    legalPending: await pendingLegalDocs(db, active.user.id),
  });
}
