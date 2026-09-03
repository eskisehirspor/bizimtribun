import { getDb } from "./db";
import { sha256 } from "./crypto";
import { findVote } from "./votes";

export function consumeToken(rawToken: string) {
  const tokenHash = sha256(rawToken);
  const row = getDb()
    .prepare(
      `SELECT t.id as token_id, t.expires_at, t.used_at, t.participant_id,
              p.verified_at, p.deleted_at, p.ip_hash, p.team_id, p.city,
              p.phone_verified_at
       FROM verify_tokens t
       JOIN participants p ON p.id = t.participant_id
       WHERE t.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        token_id: number;
        expires_at: string;
        used_at: string | null;
        participant_id: number;
        verified_at: string | null;
        deleted_at: string | null;
        ip_hash: string;
        team_id: string;
        city: string;
        phone_verified_at: string | null;
      }
    | undefined;

  if (!row) return { ok: false as const, error: "Link geçersiz." };
  if (row.used_at) return { ok: false as const, error: "Bu link zaten kullanılmış." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, error: "Linkin süresi dolmuş. Yeni mail iste." };
  }
  if (row.verified_at && !row.deleted_at) {
    return { ok: false as const, error: "Bu e-posta zaten doğrulanmış." };
  }
  if (row.deleted_at) {
    return { ok: false as const, error: "Bu kayıt silinmiş. Yeni mühür basılamaz." };
  }

  const now = new Date().toISOString();
  try {
    getDb().transaction(() => {
      const tokenHit = getDb()
        .prepare(
          `UPDATE verify_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL`,
        )
        .run(now, row.token_id);
      if (tokenHit.changes !== 1) throw new Error("VERIFY_FAILED");

      const verifiedHit = getDb()
        .prepare(
          `UPDATE participants
           SET verified_at = ?
           WHERE id = ? AND deleted_at IS NULL AND verified_at IS NULL`,
        )
        .run(now, row.participant_id);
      if (verifiedHit.changes !== 1) throw new Error("VERIFY_FAILED");

      getDb()
        .prepare(
          `INSERT INTO ip_locks (ip_hash, last_at) VALUES (?, ?)
           ON CONFLICT(ip_hash) DO UPDATE SET last_at = excluded.last_at`,
        )
        .run(row.ip_hash, now);
    })();
  } catch {
    return { ok: false as const, error: "Bu kayıt doğrulanamadı." };
  }

  const vote = findVote(getDb(), row.participant_id);
  return {
    ok: true as const,
    participantId: row.participant_id,
    teamId: row.team_id,
    city: row.city,
    phoneVerified: Boolean(row.phone_verified_at),
    voted: Boolean(vote && !vote.revoked_at),
  };
}
