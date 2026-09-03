import type Database from "better-sqlite3";
import {
  isPhoneVerificationEnabled,
  participantMeetsVoteVerification,
  voteVerificationError,
} from "./phone-verification";
import { CURRENT_POLL_ID } from "./policy";
import { isDemoRuntime, SEED_DOMAIN } from "./seed-votes";

export type VoteGate = { requirePhone?: boolean };

function requirePhoneFrom(gate?: VoteGate) {
  return gate?.requirePhone ?? isPhoneVerificationEnabled();
}

const SEED_DOMAIN_LIKE = `%@${SEED_DOMAIN}`;

export type Vote = {
  id: number;
  participant_id: number;
  poll_id: string;
  team_id: string;
  city: string;
  cast_at: string;
  revoked_at: string | null;
};

/** Active ballots for the current poll. Production also drops leftover demo emails. */
export function liveVotesWhere(): { sql: string; params: string[] } {
  const sql =
    "v.poll_id = ? AND v.revoked_at IS NULL AND p.deleted_at IS NULL";
  const params = [CURRENT_POLL_ID];
  if (isDemoRuntime()) return { sql, params };
  return {
    sql: `${sql} AND p.email_norm NOT LIKE ?`,
    params: [...params, SEED_DOMAIN_LIKE],
  };
}

export function insertVote(
  db: Database.Database,
  row: {
    participantId: number;
    teamId: string;
    city: string;
    castAt: string;
    pollId?: string;
  },
  gate?: VoteGate,
) {
  const requirePhone = requirePhoneFrom(gate);
  const participant = db
    .prepare(
      `SELECT verified_at, phone_verified_at, deleted_at
       FROM participants WHERE id = ?`,
    )
    .get(row.participantId) as
    | {
        verified_at: string | null;
        phone_verified_at: string | null;
        deleted_at: string | null;
      }
    | undefined;

  if (
    !participant ||
    participant.deleted_at ||
    !participantMeetsVoteVerification(participant, requirePhone)
  ) {
    throw new Error("VOTE_NOT_ELIGIBLE");
  }

  db.prepare(
    `INSERT INTO votes (participant_id, poll_id, team_id, city, cast_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    row.participantId,
    row.pollId ?? CURRENT_POLL_ID,
    row.teamId,
    row.city,
    row.castAt,
  );
}

export function findVote(
  db: Database.Database,
  participantId: number,
  pollId = CURRENT_POLL_ID,
) {
  return db
    .prepare(
      `SELECT id, participant_id, poll_id, team_id, city, cast_at, revoked_at
       FROM votes WHERE participant_id = ? AND poll_id = ?`,
    )
    .get(participantId, pollId) as Vote | undefined;
}

export type CastBallotResult =
  | {
      ok: true;
      already: boolean;
      teamId: string;
      city: string;
      castAt: string;
    }
  | { ok: false; error: string; status: number };

export function castBallot(
  db: Database.Database,
  participantId: number,
  gate?: VoteGate,
): CastBallotResult {
  const requirePhone = requirePhoneFrom(gate);
  try {
    return db.transaction((): CastBallotResult => {
      const participant = db
        .prepare(
          `SELECT id, team_id, city, verified_at, phone_verified_at, deleted_at
           FROM participants WHERE id = ?`,
        )
        .get(participantId) as
        | {
            id: number;
            team_id: string;
            city: string;
            verified_at: string | null;
            phone_verified_at: string | null;
            deleted_at: string | null;
          }
        | undefined;

      if (!participant || participant.deleted_at) {
        return {
          ok: false,
          error: "Kayıt bulunamadı.",
          status: 404,
        };
      }
      if (!participantMeetsVoteVerification(participant, requirePhone)) {
        return {
          ok: false,
          error: voteVerificationError(requirePhone),
          status: 403,
        };
      }

      const existing = findVote(db, participantId);
      if (existing) {
        if (existing.revoked_at) {
          return {
            ok: false,
            error: "Bu kayıt için oy hakkı kapanmış.",
            status: 409,
          };
        }
        return {
          ok: true,
          already: true,
          teamId: existing.team_id,
          city: existing.city,
          castAt: existing.cast_at,
        };
      }

      const now = new Date().toISOString();
      insertVote(
        db,
        {
          participantId,
          teamId: participant.team_id,
          city: participant.city,
          castAt: now,
        },
        { requirePhone },
      );
      return {
        ok: true,
        already: false,
        teamId: participant.team_id,
        city: participant.city,
        castAt: now,
      };
    })();
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code.includes("CONSTRAINT")) {
      const existing = findVote(db, participantId);
      if (existing && !existing.revoked_at) {
        return {
          ok: true,
          already: true,
          teamId: existing.team_id,
          city: existing.city,
          castAt: existing.cast_at,
        };
      }
    }
    return { ok: false, error: "Oy kaydedilemedi. Biraz sonra dene.", status: 500 };
  }
}

export function revokeParticipantVotes(
  db: Database.Database,
  participantId: number,
  at: string,
) {
  db.prepare(
    `UPDATE votes SET revoked_at = ? WHERE participant_id = ? AND revoked_at IS NULL`,
  ).run(at, participantId);
}

export function revokeVotesMissingPhoneVerification(
  db: Database.Database,
  at = new Date().toISOString(),
  pollId = CURRENT_POLL_ID,
  gate?: VoteGate,
) {
  if (!requirePhoneFrom(gate)) return 0;
  const info = db
    .prepare(
      `UPDATE votes
       SET revoked_at = ?
       WHERE revoked_at IS NULL
         AND poll_id = ?
         AND participant_id IN (
           SELECT id FROM participants
           WHERE phone_verified_at IS NULL
         )`,
    )
    .run(at, pollId);
  return info.changes;
}

export function backfillVotesFromParticipants(db: Database.Database, gate?: VoteGate) {
  const requirePhone = requirePhoneFrom(gate);
  const phoneSql = requirePhone ? `AND p.phone_verified_at IS NOT NULL` : "";
  db.prepare(
    `INSERT INTO votes (participant_id, poll_id, team_id, city, cast_at, revoked_at)
     SELECT p.id, ?, p.team_id, p.city, p.verified_at,
            CASE WHEN p.deleted_at IS NOT NULL THEN p.deleted_at ELSE NULL END
     FROM participants p
     WHERE p.verified_at IS NOT NULL
       ${phoneSql}
       AND NOT EXISTS (
         SELECT 1 FROM votes v
         WHERE v.participant_id = p.id AND v.poll_id = ?
       )`,
  ).run(CURRENT_POLL_ID, CURRENT_POLL_ID);
}
