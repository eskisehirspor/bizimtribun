import { z } from "zod";
import { getDb } from "@/lib/db";
import { newToken, normalizeEmail, sha256 } from "@/lib/crypto";
import { findByEmailNorm, hashedIp, registerAttemptCount } from "@/lib/stats";
import { sendDeleteEmail } from "@/lib/mail";
import { clientIp } from "@/lib/request";
import { DELETE_PER_HOUR, TOKEN_TTL_MS } from "@/lib/policy";
import { isVerifyToken, noStoreJson, readJsonBody } from "@/lib/http";
import { revokeParticipantVotes } from "@/lib/votes";
import { voidParticipantOtps } from "@/lib/otp";

const Body = z.object({
  email: z.string().email().max(120),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const ipHash = hashedIp(`delete:${await clientIp()}`);
  if (registerAttemptCount(ipHash) >= DELETE_PER_HOUR) {
    return noStoreJson({ error: "Çok fazla deneme. Biraz sonra dene." }, 429);
  }
  getDb()
    .prepare(`INSERT INTO register_attempts (ip_hash, created_at) VALUES (?, ?)`)
    .run(ipHash, new Date().toISOString());

  const parsed = Body.safeParse(body.data);
  const generic = {
    ok: true,
    message: "Adres sistemdeyse silme linki mailine düşer.",
  };
  if (!parsed.success) {
    return noStoreJson({ error: "Geçerli e-posta yaz." }, 400);
  }

  const existing = findByEmailNorm(normalizeEmail(parsed.data.email));
  if (!existing || existing.deleted_at) {
    return noStoreJson(generic);
  }

  const token = newToken();
  const tokenHash = sha256(`del:${token}`);
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  getDb()
    .prepare(
      `INSERT INTO verify_tokens (participant_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    )
    .run(existing.id, tokenHash, expires);

  const sent = await sendDeleteEmail(existing.email, token);
  return noStoreJson({
    ...generic,
    ...(sent.dev && process.env.NODE_ENV !== "production"
      ? { devLink: sent.link }
      : {}),
  });
}

export async function PUT(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }
  const token = (body.data as { token?: unknown })?.token;
  if (!isVerifyToken(token)) {
    return noStoreJson({ error: "Token yok." }, 400);
  }
  const tokenHash = sha256(`del:${token}`);
  const row = getDb()
    .prepare(
      `SELECT t.id as token_id, t.expires_at, t.used_at, t.participant_id
       FROM verify_tokens t WHERE t.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        token_id: number;
        expires_at: string;
        used_at: string | null;
        participant_id: number;
      }
    | undefined;

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return noStoreJson({ error: "Silme linki geçersiz." }, 400);
  }

  const now = new Date().toISOString();
  const tx = getDb().transaction(() => {
    getDb()
      .prepare(`UPDATE verify_tokens SET used_at = ? WHERE id = ?`)
      .run(now, row.token_id);
    getDb()
      .prepare(
        `UPDATE verify_tokens SET used_at = ? WHERE participant_id = ? AND used_at IS NULL`,
      )
      .run(now, row.participant_id);
    getDb()
      .prepare(
        `UPDATE participants
         SET deleted_at = ?, email = '', email_norm = ?, first_name = '', last_name = '',
             phone = '', phone_norm = '', verified_at = NULL, phone_verified_at = NULL
         WHERE id = ?`,
      )
      .run(now, `deleted:${row.participant_id}`, row.participant_id);
    revokeParticipantVotes(getDb(), row.participant_id, now);
    voidParticipantOtps(row.participant_id, now);
  });
  tx();
  return noStoreJson({ ok: true });
}
