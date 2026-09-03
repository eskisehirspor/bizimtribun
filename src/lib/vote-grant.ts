import type Database from "better-sqlite3";
import { hmac, newToken } from "./crypto";
import { VOTE_GRANT_COOKIE, VOTE_GRANT_TTL_MS } from "./policy";

export const DOGRULA_PUBLIC_PATH = "/dogrula";

export function voteGrantTokenHash(raw: string) {
  return hmac(`vote-grant-v2:${raw}`);
}

export function urlLeaksVoteGrant(url: string) {
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.searchParams.has("grant")) return true;
    if (parsed.pathname.includes("/grant/")) return true;
  } catch {
    if (/[?&]grant=/i.test(url)) return true;
  }
  return false;
}

export function voteGrantCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/vote" as const,
    maxAge: maxAgeSec,
  };
}

export function attachVoteGrantCookieOptions() {
  return voteGrantCookieOptions(Math.floor(VOTE_GRANT_TTL_MS / 1000));
}

export function voteGrantFromCookieHeader(header: string | null) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VOTE_GRANT_COOKIE) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

export function issueVoteGrant(db: Database.Database, participantId: number) {
  const raw = newToken();
  const now = Date.now();
  const created = new Date(now).toISOString();
  const expires = new Date(now + VOTE_GRANT_TTL_MS).toISOString();
  db.prepare(
    `UPDATE vote_grants SET consumed_at = ?
     WHERE participant_id = ? AND consumed_at IS NULL`,
  ).run(created, participantId);
  db.prepare(
    `INSERT INTO vote_grants
     (participant_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(participantId, voteGrantTokenHash(raw), expires, created);
  return { raw, expiresAt: expires };
}

export type VoteGrantRow = {
  id: number;
  participantId: number;
  consumedAt: string | null;
  expiresAt: string;
};

export function lookupVoteGrant(
  db: Database.Database,
  raw: string | null | undefined,
): { ok: true; grant: VoteGrantRow } | { ok: false; error: string; status: number } {
  if (!raw || typeof raw !== "string" || raw.length < 32 || raw.length > 128) {
    return { ok: false, error: "Oy anahtarı geçersiz.", status: 401 };
  }
  const row = db
    .prepare(
      `SELECT id, participant_id, consumed_at, expires_at
       FROM vote_grants WHERE token_hash = ?`,
    )
    .get(voteGrantTokenHash(raw)) as
    | {
        id: number;
        participant_id: number;
        consumed_at: string | null;
        expires_at: string;
      }
    | undefined;
  if (!row) return { ok: false, error: "Oy anahtarı geçersiz.", status: 401 };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Oy anahtarı geçersiz.", status: 401 };
  }
  return {
    ok: true,
    grant: {
      id: row.id,
      participantId: row.participant_id,
      consumedAt: row.consumed_at,
      expiresAt: row.expires_at,
    },
  };
}

export function consumeVoteGrant(db: Database.Database, grantId: number) {
  const now = new Date().toISOString();
  const hit = db
    .prepare(
      `UPDATE vote_grants
       SET consumed_at = ?
       WHERE id = ? AND consumed_at IS NULL`,
    )
    .run(now, grantId);
  return hit.changes === 1;
}

export function publicVoteStatus(input: {
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneVerificationRequired: boolean;
  voted: boolean;
  teamId?: string | null;
  city?: string | null;
  castAt?: string | null;
}) {
  const body: {
    ok: true;
    emailVerified: boolean;
    phoneVerified: boolean;
    phoneVerificationRequired: boolean;
    voted: boolean;
    castAt: string | null;
    teamId?: string;
    city?: string;
  } = {
    ok: true,
    emailVerified: input.emailVerified,
    phoneVerified: input.phoneVerified,
    phoneVerificationRequired: input.phoneVerificationRequired,
    voted: input.voted,
    castAt: input.voted ? input.castAt ?? null : null,
  };
  if (input.voted && input.teamId && input.city) {
    body.teamId = input.teamId;
    body.city = input.city;
  }
  return body;
}

export function errorOmitsSecret(message: string, secret: string) {
  return !message.includes(secret);
}
