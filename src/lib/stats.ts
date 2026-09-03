import { getDb, type Participant } from "./db";
import { TEAMS } from "./teams";
import { hmac } from "./crypto";
import { IP_WINDOW_MS } from "./policy";
import { applyDemoVotes, isDemoRuntime } from "./seed-votes";
import { liveVotesWhere } from "./votes";

function withSeed() {
  if (isDemoRuntime()) applyDemoVotes(getDb());
  return getDb();
}

export function teamCounts() {
  const live = liveVotesWhere();
  const rows = withSeed()
    .prepare(
      `SELECT v.team_id as id, COUNT(*) as votes
       FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE ${live.sql}
       GROUP BY v.team_id`,
    )
    .all(...live.params) as { id: string; votes: number }[];

  const map = Object.fromEntries(rows.map((r) => [r.id, r.votes]));
  return TEAMS.map((t) => ({ ...t, votes: map[t.id] ?? 0 }));
}

export type CityStanding = { teamId: string; votes: number };

export function cityStandings() {
  const live = liveVotesWhere();
  const rows = withSeed()
    .prepare(
      `SELECT v.city, v.team_id, COUNT(*) as c
       FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE ${live.sql}
       GROUP BY v.city, v.team_id`,
    )
    .all(...live.params) as { city: string; team_id: string; c: number }[];

  const byCity = new Map<string, CityStanding[]>();
  for (const row of rows) {
    const list = byCity.get(row.city) ?? [];
    list.push({ teamId: row.team_id, votes: row.c });
    byCity.set(row.city, list);
  }
  for (const list of byCity.values()) {
    list.sort((a, b) => b.votes - a.votes);
  }
  return Object.fromEntries([...byCity.entries()]);
}

export function cityLeaders() {
  return Object.fromEntries(
    Object.entries(cityStandings()).map(([city, rows]) => [city, rows[0]]),
  );
}

export function totalVerified() {
  const live = liveVotesWhere();
  const row = withSeed()
    .prepare(
      `SELECT COUNT(*) as c
       FROM votes v
       JOIN participants p ON p.id = v.participant_id
       WHERE ${live.sql}`,
    )
    .get(...live.params) as { c: number };
  return row.c;
}

export function findByEmailNorm(emailNorm: string) {
  return getDb()
    .prepare(`SELECT * FROM participants WHERE email_norm = ?`)
    .get(emailNorm) as Participant | undefined;
}

export function findByEmailHash(emailHash: string) {
  return getDb()
    .prepare(`SELECT * FROM participants WHERE email_hash = ?`)
    .get(emailHash) as Participant | undefined;
}

export function findByPhoneHash(phoneHash: string) {
  if (!phoneHash) return undefined;
  return getDb()
    .prepare(`SELECT * FROM participants WHERE phone_hash = ?`)
    .get(phoneHash) as Participant | undefined;
}

export function identityConsumed(row: Participant | undefined) {
  if (!row) return false;
  return Boolean(row.deleted_at || row.verified_at);
}

export function ipLocked(ipHash: string) {
  const row = getDb()
    .prepare(`SELECT last_at FROM ip_locks WHERE ip_hash = ?`)
    .get(ipHash) as { last_at: string } | undefined;
  if (!row) return false;
  return Date.now() - new Date(row.last_at).getTime() < IP_WINDOW_MS;
}

export function fingerprintUsedRecently(fpHash: string) {
  const row = getDb()
    .prepare(
      `SELECT verified_at FROM participants
       WHERE fingerprint_hash = ? AND verified_at IS NOT NULL AND deleted_at IS NULL
       ORDER BY verified_at DESC LIMIT 1`,
    )
    .get(fpHash) as { verified_at: string } | undefined;
  if (!row) return false;
  return Date.now() - new Date(row.verified_at).getTime() < IP_WINDOW_MS;
}

export function registerAttemptCount(ipHash: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM register_attempts
       WHERE ip_hash = ? AND created_at >= ?`,
    )
    .get(ipHash, since) as { c: number };
  return row.c;
}

export function hashedIp(ip: string) {
  return hmac(`ip:${ip}`);
}
