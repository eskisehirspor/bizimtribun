import { isPhoneVerificationEnabled } from "@/lib/phone-verification";
import { consumeToken } from "@/lib/verify";
import { clientIp } from "@/lib/request";
import { getDb } from "@/lib/db";
import { hashedIp, registerAttemptCount } from "@/lib/stats";
import { VERIFY_PER_HOUR, VOTE_GRANT_COOKIE } from "@/lib/policy";
import { isVerifyToken, noStoreJson, readJsonBody } from "@/lib/http";
import {
  attachVoteGrantCookieOptions,
  issueVoteGrant,
} from "@/lib/vote-grant";

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const ipHash = hashedIp(`verify:${await clientIp()}`);
  if (registerAttemptCount(ipHash) >= VERIFY_PER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());

  const token = (body.data as { token?: unknown })?.token;
  if (!isVerifyToken(token)) {
    return noStoreJson({ error: "Token yok." }, 400);
  }
  const result = consumeToken(token);
  if (!result.ok) {
    return noStoreJson({ error: result.error }, 400);
  }

  const issued = issueVoteGrant(getDb(), result.participantId);
  const res = noStoreJson({
    ok: true,
    teamId: result.teamId,
    city: result.city,
    phoneVerified: result.phoneVerified,
    voted: result.voted,
    phoneVerificationRequired: isPhoneVerificationEnabled(),
  });
  res.cookies.set(VOTE_GRANT_COOKIE, issued.raw, attachVoteGrantCookieOptions());
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
