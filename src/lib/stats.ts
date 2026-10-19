import { getDb, type Participant } from "./db";
import { TEAMS } from "./teams";
import { hmac } from "./crypto";

/**
 * Public census numbers. All of them come from active rows in fan_votes
 * (see fan-votes.ts for the exact definition of "doğrulanmış taraftar").
 * Nothing here is cached per user, and no client-supplied number is trusted.
 */
const LIVE = `fv.status = 'active'`;

export function teamCounts() {
  const rows = getDb()
    .prepare(
      `SELECT fv.team_id as id, COUNT(*) as votes
       FROM fan_votes fv WHERE ${LIVE}
       GROUP BY fv.team_id`,
    )
    .all() as { id: string; votes: number }[];
  const map = Object.fromEntries(rows.map((r) => [r.id, r.votes]));
  return TEAMS.map((t) => ({ ...t, votes: map[t.id] ?? 0 }));
}

export type CityStanding = { teamId: string; votes: number };
export type CityLeader = CityStanding & {
  /** True when two or more teams share the top spot; no team is picked. */
  tied: boolean;
  coLeaderIds: string[];
};

export function cityStandings() {
  const rows = getDb()
    .prepare(
      `SELECT fv.city, fv.team_id, COUNT(*) as c
       FROM fan_votes fv
       WHERE ${LIVE} AND fv.city IS NOT NULL
       GROUP BY fv.city, fv.team_id`,
    )
    .all() as { city: string; team_id: string; c: number }[];

  const byCity = new Map<string, CityStanding[]>();
  for (const row of rows) {
    const list = byCity.get(row.city) ?? [];
    list.push({ teamId: row.team_id, votes: row.c });
    byCity.set(row.city, list);
  }
  for (const list of byCity.values()) {
    list.sort((a, b) => b.votes - a.votes || a.teamId.localeCompare(b.teamId));
  }
  return Object.fromEntries([...byCity.entries()]);
}

export function leaderOf(rows: CityStanding[]): CityLeader | undefined {
  const top = rows[0];
  if (!top || top.votes <= 0) return undefined;
  const coLeaderIds = rows.filter((r) => r.votes === top.votes).map((r) => r.teamId);
  return { ...top, tied: coLeaderIds.length > 1, coLeaderIds };
}

export function cityLeaders(standings = cityStandings()) {
  const out: Record<string, CityLeader> = {};
  for (const [city, rows] of Object.entries(standings)) {
    const leader = leaderOf(rows);
    if (leader) out[city] = leader;
  }
  return out;
}

/** "Doğrulanmış taraftar": active, phone-verified, one-per-account votes. */
export function totalVerified() {
  const row = getDb()
    .prepare(`SELECT COUNT(*) as c FROM fan_votes fv WHERE ${LIVE}`)
    .get() as { c: number };
  return row.c;
}

/** Legacy census lookup, used only by the old data-deletion flow. */
export function findByEmailNorm(emailNorm: string) {
  return getDb()
    .prepare(`SELECT * FROM participants WHERE email_norm = ?`)
    .get(emailNorm) as Participant | undefined;
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
