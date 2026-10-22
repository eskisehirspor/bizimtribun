import { getDb } from "./db";
import {
  LEAGUE_LABEL,
  LEAGUE_ORDER,
  getTeam,
  teamShort,
  leaguePaper,
  resolveTeamAlias,
  type LeagueId,
  type Team,
} from "./teams";

/**
 * Server-side team catalog read from the database, so admin edits (name,
 * league, city, colours, active flags) show up everywhere. teams.ts only
 * provides the initial seed and fallback colours.
 */
export type CatalogTeam = Team & { isActive: boolean; isForumActive: boolean };
export type League = { id: LeagueId; name: string; sortOrder: number };

type TeamRow = {
  id: string;
  name: string;
  league: string;
  city: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  is_active: number;
  is_forum_active: number;
};

function toCatalogTeam(row: TeamRow): CatalogTeam {
  const seed = getTeam(row.id);
  const league = (LEAGUE_ORDER as string[]).includes(row.league)
    ? (row.league as LeagueId)
    : "bal";
  return {
    id: row.id,
    name: row.name,
    short: teamShort(row.id, row.name),
    city: row.city ?? seed?.city ?? "",
    league,
    bleed: row.color_primary ?? seed?.bleed ?? "#111111",
    accent: row.color_secondary ?? seed?.accent ?? "#FFFFFF",
    paper: leaguePaper(league),
    ink: "#111",
    isActive: row.is_active === 1,
    isForumActive: row.is_forum_active === 1,
  };
}

const COLUMNS = `id, name, league, city, color_primary, color_secondary, is_active, is_forum_active`;

export async function listLeagues(): Promise<League[]> {
  const rows = await getDb()
      .prepare(`SELECT id, name, sort_order FROM leagues ORDER BY sort_order, id`)
      .all() as { id: LeagueId; name: string; sort_order: number }[];
  if (rows.length === 0) {
    return LEAGUE_ORDER.map((id, i) => ({ id, name: LEAGUE_LABEL[id], sortOrder: i }));
  }
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
}

export async function leagueLabels(): Promise<Record<string, string>> {
  return Object.fromEntries((await listLeagues()).map((l) => [l.id, l.name]));
}

/**
 * All teams that ever existed (inactive ones keep their vote history),
 * ordered by league order then name. `activeOnly` limits to teams that can
 * receive new votes.
 */
export async function listTeamCatalog(opts: { activeOnly?: boolean } = {}): Promise<CatalogTeam[]> {
  const rows = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM teams ${opts.activeOnly ? "WHERE is_active = 1" : ""}`)
      .all() as TeamRow[];
  const order = new Map((await listLeagues()).map((l) => [l.id as string, l.sortOrder]));
  return rows
    .map(toCatalogTeam)
    .sort(
      (a, b) =>
        (order.get(a.league) ?? 99) - (order.get(b.league) ?? 99) ||
        a.name.localeCompare(b.name, "tr"),
    );
}

export async function getCatalogTeam(id: string): Promise<CatalogTeam | undefined> {
  const row = await getDb()
      .prepare(`SELECT ${COLUMNS} FROM teams WHERE id = ?`)
      .get(resolveTeamAlias(id)) as TeamRow | undefined;
  return row ? toCatalogTeam(row) : undefined;
}

export async function forumActiveTeamIds(): Promise<string[]> {
  return (await listTeamCatalog())
    .filter((t) => t.isForumActive)
    .map((t) => t.id);
}

export async function isForumActiveTeamDb(id: string) {
  return (await getCatalogTeam(id))?.isForumActive ?? false;
}
