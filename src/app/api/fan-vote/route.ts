import { z } from "zod";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { castFanVote, findFanVote } from "@/lib/fan-votes";
import { rateCount, rateNote } from "@/lib/auth-otp";
import { hmac } from "@/lib/crypto";
import { FAN_VOTE_PER_USER_HOUR } from "@/lib/policy";

const Body = z.object({
  teamId: z.string().min(1).max(64),
  city: z.string().max(40).optional().nullable(),
  confirmTeamLocked: z.literal(true),
});

function voteView(vote: ReturnType<typeof findFanVote>) {
  if (!vote) return null;
  return {
    teamId: vote.team_id,
    city: vote.city,
    castAt: vote.cast_at,
    counted: vote.status === "active",
  };
}

export async function GET(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  return noStoreJson({
    ok: true,
    phoneVerified: Boolean(active.user.phone_verified_at),
    vote: voteView(findFanVote(getDb(), active.user.id)),
  });
}

/** The one-time, permanent team choice for accounts that do not have a vote yet. */
export async function POST(req: Request) {
  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) return noStoreJson({ error: active.error }, active.status);
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Takım seç ve seçimin kalıcı olduğunu onayla." }, 400);
  }
  const db = getDb();
  const key = hmac(`fan-vote-user:${active.user.id}`);
  if (rateCount(db, key, 60 * 60 * 1000) >= FAN_VOTE_PER_USER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra tekrar dene." }, 429);
  }
  rateNote(db, key);
  const result = castFanVote(db, {
    userId: active.user.id,
    teamId: parsed.data.teamId,
    city: parsed.data.city ?? null,
  });
  if (!result.ok) return noStoreJson({ error: result.error, code: result.code }, result.status);
  return noStoreJson({ ok: true, already: result.already, vote: voteView(result.vote) });
}
