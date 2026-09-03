import { isBrowserSameSite } from "@/lib/request";
import { noStoreJson } from "@/lib/http";
import {
  clearAdmin2faCookie,
  clearSessionCookie,
  readSessionToken,
  revokeSessionByToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (!isBrowserSameSite(req)) {
    return noStoreJson({ error: "Geçersiz kaynak." }, 400);
  }
  const token = await readSessionToken(req);
  revokeSessionByToken(token);
  const res = noStoreJson({ ok: true });
  clearSessionCookie(res);
  return clearAdmin2faCookie(res);
}
