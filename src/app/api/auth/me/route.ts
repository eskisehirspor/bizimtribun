import { noStoreJson } from "@/lib/http";
import {
  clearSessionCookie,
  getSessionUser,
  readSessionToken,
  requireActiveUser,
  revokeSessionByToken,
} from "@/lib/auth";
import { isUserBanned } from "@/lib/users";

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return noStoreJson({ ok: true, user: null });
  }
  if (isUserBanned(user)) {
    revokeSessionByToken(await readSessionToken(req));
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
  return noStoreJson({ ok: true, user: active.publicUser });
}
