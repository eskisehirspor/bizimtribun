import { getDb, type Participant } from "./db";
import { listTeamCatalog } from "./team-catalog";
import { hmac } from "./crypto";

/**
 * Public census numbers. All of them come from active rows in fan_votes
 * (see fan-votes.ts for the exact definition of "doğrulanmış taraftar").
 * Nothing here is cached per user, and no client-supplied number is trusted.
 */
const LIVE = `fv.status = 'active'`;

/**
 * Aggregates are recomputed only when the underlying rows change: the key is
 * the active vote count, the newest vote id and the team catalog's last edit.
 * Votes are append-only (a void lowers the active count), so the key moves
 * on every change and the numbers are never stale.
 */
const memo = new WeakMap<object, Map<string, { key: string; value: unknown }>>();

function dataVersion() {
  const db = getDb();
  const v = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM fan_votes WHERE status = 'active') as active,
              (SELECT COALESCE(MAX(id), 0) FROM fan_votes) || ':' ||
                (SELECT COUNT(*) FROM fan_vote_restores) as maxId,
              (SELECT COUNT(*) || ':' || COALESCE(MAX(admin_edited_at), '') FROM teams) as teams`,
    )
    .get() as { active: number; maxId: string; teams: string };
  return `${v.active}:${v.maxId}:${v.teams}`;
}

function memoized<T>(name: string, compute: () => T): T {
  const db = getDb();
  let slot = memo.get(db);
  if (!slot) memo.set(db, (slot = new Map()));
  const key = dataVersion();
  const hit = slot.get(name);
  if (hit && hit.key === key) return hit.value as T;
  const value = compute();
  slot.set(name, { key, value });
  return value;
}

export function teamCounts() {
  return memoized("teamCounts", computeTeamCounts);
}

function computeTeamCounts() {
  const rows = getDb()
    .prepare(
      `SELECT fv.team_id as id, COUNT(*) as votes
       FROM fan_votes fv WHERE ${LIVE}
       GROUP BY fv.team_id`,
    )
    .all() as { id: string; votes: number }[];
  const map = Object.fromEntries(rows.map((r) => [r.id, r.votes]));
  // Inactive teams stay listed while they still hold votes, so history
  // never silently disappears from the public count.
  return listTeamCatalog()
    .map((t) => ({ ...t, votes: map[t.id] ?? 0 }))
    .filter((t) => t.isActive || t.votes > 0);
}

export type CityStanding = { teamId: string; votes: number };
export type CityLeader = CityStanding & {
  /** True when two or more teams share the top spot; no team is picked. */
  tied: boolean;
  coLeaderIds: string[];
};

export function cityStandings() {
  return memoized("cityStandings", computeCityStandings);
}

function computeCityStandings(): Record<string, CityStanding[]> {
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

export type TeamSummary = {
  votes: number;
  total: number;
  /** 1-based; teams with equal votes share a rank. Null with no votes yet. */
  rank: number | null;
  leagueRank: number | null;
  tiedWith: number;
  provincesLed: number;
  provincesCoLed: number;
  topProvinces: { province: string; votes: number }[];
};

/** One team's public numbers, from the same active fan_votes rows as every other count. */
export function teamSummary(teamId: string): TeamSummary | null {
  const teams = teamCounts();
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  const total = teams.reduce((sum, t) => sum + t.votes, 0);
  const rankIn = (list: typeof teams) =>
    team.votes > 0 ? 1 + list.filter((t) => t.votes > team.votes).length : null;
  let provincesLed = 0;
  let provincesCoLed = 0;
  for (const leader of Object.values(cityLeaders())) {
    if (!leader.coLeaderIds.includes(teamId)) continue;
    if (leader.tied) provincesCoLed += 1;
    else provincesLed += 1;
  }
  const topProvinces = getDb()
    .prepare(
      `SELECT fv.city as province, COUNT(*) as votes FROM fan_votes fv
       WHERE ${LIVE} AND fv.team_id = ? AND fv.city IS NOT NULL
       GROUP BY fv.city ORDER BY votes DESC, fv.city LIMIT 5`,
    )
    .all(teamId) as { province: string; votes: number }[];
  return {
    votes: team.votes,
    total,
    rank: rankIn(teams),
    leagueRank: rankIn(teams.filter((t) => t.league === team.league)),
    tiedWith: team.votes > 0 ? teams.filter((t) => t.id !== teamId && t.votes === team.votes).length : 0,
    provincesLed,
    provincesCoLed,
    topProvinces,
  };
}
