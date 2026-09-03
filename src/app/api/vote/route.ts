import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  identityEmailHash,
  identityPhoneHash,
  normalizeEmail,
} from "@/lib/crypto";
import { hashedIp, findByEmailHash, findByPhoneHash, registerAttemptCount } from "@/lib/stats";
import { isTrMobile, normalizePhone } from "@/lib/phone";
import { clientIp } from "@/lib/request";
import { isPhoneVerificationEnabled, voteVerificationError } from "@/lib/phone-verification";
import { VERIFY_PER_HOUR } from "@/lib/policy";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { castBallot, findVote } from "@/lib/votes";
import {
  consumeVoteGrant,
  lookupVoteGrant,
  publicVoteStatus,
  voteGrantFromCookieHeader,
} from "@/lib/vote-grant";

const Body = z.object({
  email: z.string().email().max(120).optional(),
  phone: z.string().min(10).max(20).optional(),
});

function voteJson(result: ReturnType<typeof castBallot>) {
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  const res = noStoreJson({
    ok: true,
    alreadyVoted: result.already,
    teamId: result.teamId,
    city: result.city,
    castAt: result.castAt,
    message: result.already
      ? "Bu mühür zaten basılmış."
      : "Oyun kaydedildi.",
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

function participantByEmailPhone(email: string, phone: string) {
  const phoneNorm = normalizePhone(phone);
  if (!isTrMobile(phoneNorm)) return null;
  const byEmail = findByEmailHash(identityEmailHash(normalizeEmail(email)));
  const byPhone = findByPhoneHash(identityPhoneHash(phoneNorm));
  if (!byEmail || !byPhone || byEmail.id !== byPhone.id || byEmail.deleted_at) {
    return null;
  }
  return byEmail.id;
}

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const parsed = Body.safeParse(body.data ?? {});
  if (!parsed.success) {
    return noStoreJson({ error: "E-posta ve telefon gerekli." }, 400);
  }

  const ipHash = hashedIp(`vote:${await clientIp()}`);
  if (registerAttemptCount(ipHash) >= VERIFY_PER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());

  const db = getDb();
  const cookieRaw = voteGrantFromCookieHeader(req.headers.get("cookie"));
  const fromCookie = cookieRaw ? lookupVoteGrant(db, cookieRaw) : null;

  let participantId: number | null = null;
  let grantId: number | null = null;

  if (fromCookie?.ok) {
    if (fromCookie.grant.consumedAt) {
      return noStoreJson({ error: "Oy anahtarı geçersiz." }, 401);
    }
    participantId = fromCookie.grant.participantId;
    grantId = fromCookie.grant.id;
  } else if (parsed.data.email && parsed.data.phone) {
    participantId = participantByEmailPhone(parsed.data.email, parsed.data.phone);
    if (participantId == null) {
      return noStoreJson({ error: "Kayıt bulunamadı." }, 404);
    }
  } else if (cookieRaw) {
    return noStoreJson({ error: fromCookie && !fromCookie.ok ? fromCookie.error : "Oy anahtarı geçersiz." }, 401);
  }

  if (participantId == null) {
    return noStoreJson({ error: "E-posta ve telefon gerekli." }, 400);
  }

  const result = castBallot(db, participantId);
  if (result.ok && grantId != null) {
    consumeVoteGrant(db, grantId);
  }
  return voteJson(result);
}

export async function GET(req: Request) {
  const anonymous = () => {
    const res = noStoreJson(
      publicVoteStatus({
        emailVerified: false,
        phoneVerified: false,
        phoneVerificationRequired: isPhoneVerificationEnabled(),
        voted: false,
      }),
    );
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  const cookieRaw = voteGrantFromCookieHeader(req.headers.get("cookie"));
  if (!cookieRaw) return anonymous();

  const looked = lookupVoteGrant(getDb(), cookieRaw);
  if (!looked.ok) return anonymous();

  const p = getDb()
    .prepare(
      `SELECT verified_at, phone_verified_at, deleted_at
       FROM participants WHERE id = ?`,
    )
    .get(looked.grant.participantId) as
    | {
        verified_at: string | null;
        phone_verified_at: string | null;
        deleted_at: string | null;
      }
    | undefined;

  if (!p || p.deleted_at) return anonymous();

  const vote = findVote(getDb(), looked.grant.participantId);
  const live = vote && !vote.revoked_at ? vote : undefined;
  const res = noStoreJson(
    publicVoteStatus({
      emailVerified: Boolean(p.verified_at),
      phoneVerified: Boolean(p.phone_verified_at),
      phoneVerificationRequired: isPhoneVerificationEnabled(),
      voted: Boolean(live),
      teamId: live?.team_id,
      city: live?.city,
      castAt: live?.cast_at ?? null,
    }),
  );
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
