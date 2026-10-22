import { isUniqueViolation, type Db } from "./db";
import { writeAudit } from "./audit";
import { foldTr, isLeagueId } from "./teams";
import { getCityByName } from "./cities";

/**
 * Admin edits to teams, leagues and seasons. Every change is audited with
 * the before/after values. Nothing here touches fan_votes: renaming a team
 * or moving it to another league keeps its votes, and a deactivated team
 * keeps its history but takes no new votes.
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Result = { ok: true } | { ok: false; error: string; status: number };

export type TeamPatch = {
  name?: string;
  league?: string;
  city?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  isActive?: boolean;
  isForumActive?: boolean;
};

type TeamDbRow = {
  id: string;
  name: string;
  league: string;
  city: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  is_active: number;
  is_forum_active: number;
};

export async function updateTeam(
  db: Db,
  actorUserId: number,
  teamId: string,
  patch: TeamPatch,
  reason: string,
): Promise<Result> {
  return db.transaction(async (): Promise<Result> => {
    const before = await db.prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as
      | TeamDbRow
      | undefined;
    if (!before) return { ok: false, error: "Takım bulunamadı.", status: 404 };

    const next = { ...before };
    if (patch.name !== undefined) {
      const name = patch.name.replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 60) {
        return { ok: false, error: "Takım adı 2-60 karakter olmalı.", status: 400 };
      }
      const clash = (
        await db.prepare(`SELECT id, name FROM teams WHERE id != ?`).all(teamId) as {
          id: string;
          name: string;
        }[]
      ).find((t) => foldTr(t.name) === foldTr(name));
      if (clash) return { ok: false, error: "Bu adla başka bir takım var.", status: 409 };
      next.name = name;
    }
    if (patch.league !== undefined) {
      if (!isLeagueId(patch.league)) return { ok: false, error: "Geçersiz lig.", status: 400 };
      next.league = patch.league;
    }
    if (patch.city !== undefined) {
      const city = getCityByName(patch.city.trim());
      if (!city) return { ok: false, error: "Geçersiz il.", status: 400 };
      next.city = city.name;
    }
    if (patch.colorPrimary !== undefined) {
      if (!HEX.test(patch.colorPrimary)) return { ok: false, error: "Renk #RRGGBB olmalı.", status: 400 };
      next.color_primary = patch.colorPrimary.toUpperCase();
    }
    if (patch.colorSecondary !== undefined) {
      if (!HEX.test(patch.colorSecondary)) return { ok: false, error: "Renk #RRGGBB olmalı.", status: 400 };
      next.color_secondary = patch.colorSecondary.toUpperCase();
    }
    if (patch.isActive !== undefined) next.is_active = patch.isActive ? 1 : 0;
    if (patch.isForumActive !== undefined) next.is_forum_active = patch.isForumActive ? 1 : 0;

    const changed: Record<string, string | number | null> = {};
    for (const key of Object.keys(next) as (keyof TeamDbRow)[]) {
      if (next[key] !== before[key]) {
        changed[`${key}_before`] = before[key];
        changed[`${key}_after`] = next[key];
      }
    }
    if (Object.keys(changed).length === 0) return { ok: true };

    const now = new Date().toISOString();
    await db.prepare(
            `UPDATE teams SET name = ?, league = ?, city = ?, color_primary = ?, color_secondary = ?,
         is_active = ?, is_forum_active = ?, admin_edited_at = ?
       WHERE id = ?`,
          ).run(
            next.name,
            next.league,
            next.city,
            next.color_primary,
            next.color_secondary,
            next.is_active,
            next.is_forum_active,
            now,
            teamId,
          );
    await writeAudit(db, {
            actorUserId,
            action: "team_update",
            targetType: "team",
            targetId: teamId,
            reason,
            meta: changed,
          });
    return { ok: true };
  })();
}

export async function updateLeague(
  db: Db,
  actorUserId: number,
  leagueId: string,
  patch: { name?: string; sortOrder?: number },
  reason: string,
): Promise<Result> {
  return db.transaction(async (): Promise<Result> => {
    const before = await db.prepare(`SELECT * FROM leagues WHERE id = ?`).get(leagueId) as
      | { id: string; name: string; sort_order: number }
      | undefined;
    if (!before) return { ok: false, error: "Lig bulunamadı.", status: 404 };
    const name = patch.name === undefined ? before.name : patch.name.replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 40) {
      return { ok: false, error: "Lig adı 2-40 karakter olmalı.", status: 400 };
    }
    const sortOrder = patch.sortOrder ?? before.sort_order;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 99) {
      return { ok: false, error: "Sıra 0-99 arası olmalı.", status: 400 };
    }
    if (name === before.name && sortOrder === before.sort_order) return { ok: true };
    await db.prepare(`UPDATE leagues SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?`).run(
            name,
            sortOrder,
            new Date().toISOString(),
            leagueId,
          );
    await writeAudit(db, {
            actorUserId,
            action: "league_update",
            targetType: "league",
            targetId: leagueId,
            reason,
            meta: {
              name_before: before.name,
              name_after: name,
              sort_before: before.sort_order,
              sort_after: sortOrder,
            },
          });
    return { ok: true };
  })();
}

export type SeasonRow = {
  id: number;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: number;
  created_at: string;
  team_count: number;
};

export async function listSeasons(db: Db) {
  return await db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM team_seasons ts WHERE ts.season_id = s.id) as team_count
       FROM seasons s ORDER BY s.starts_on DESC`,
      )
      .all() as SeasonRow[];
}

export async function currentSeason(db: Db) {
  return await db.prepare(`SELECT id, label, starts_on, ends_on FROM seasons WHERE is_current = 1`).get() as
    | { id: number; label: string; starts_on: string; ends_on: string }
    | undefined;
}

/**
 * Opens a season and records which league every active team is in right
 * now. That snapshot is the season's history; later league moves do not
 * rewrite it.
 */
export async function createSeason(
  db: Db,
  actorUserId: number,
  input: { label: string; startsOn: string; endsOn: string; makeCurrent: boolean },
): Promise<Result & { id?: number }> {
  const label = input.label.trim();
  if (!/^[0-9]{4}[-/][0-9]{2,4}$/.test(label)) {
    return { ok: false, error: "Sezon adı 2026-27 biçiminde olmalı.", status: 400 };
  }
  if (!DATE.test(input.startsOn) || !DATE.test(input.endsOn) || input.endsOn <= input.startsOn) {
    return { ok: false, error: "Başlangıç ve bitiş tarihi geçersiz.", status: 400 };
  }
  try {
    return await db.transaction(async () => {
          if (input.makeCurrent) await db.prepare(`UPDATE seasons SET is_current = 0 WHERE is_current = 1`).run();
          const now = new Date().toISOString();
          const created = await db
                  .prepare(
                    `INSERT INTO seasons (label, starts_on, ends_on, is_current, created_at) VALUES (?, ?, ?, ?, ?)`,
                  )
                  .run(label, input.startsOn, input.endsOn, input.makeCurrent ? 1 : 0, now);
          const id = Number(created.lastInsertRowid);
          const snap = await db
                  .prepare(
                    `INSERT INTO team_seasons (season_id, team_id, league_id)
           SELECT ?, id, league FROM teams WHERE is_active = 1 AND league IN (SELECT id FROM leagues)`,
                  )
                  .run(id);
          await writeAudit(db, {
                    actorUserId,
                    action: "season_create",
                    targetType: "season",
                    targetId: id,
                    meta: {
                      label,
                      startsOn: input.startsOn,
                      endsOn: input.endsOn,
                      current: input.makeCurrent,
                      teams: snap.changes,
                    },
                  });
          return { ok: true as const, id };
        })();
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "Bu sezon zaten var.", status: 409 };
    }
    throw err;
  }
}

export async function setCurrentSeason(
  db: Db,
  actorUserId: number,
  seasonId: number,
  reason: string,
): Promise<Result> {
  return db.transaction(async (): Promise<Result> => {
    const row = await db.prepare(`SELECT id, label, is_current FROM seasons WHERE id = ?`).get(seasonId) as
      | { id: number; label: string; is_current: number }
      | undefined;
    if (!row) return { ok: false, error: "Sezon bulunamadı.", status: 404 };
    if (row.is_current) return { ok: true };
    const prev = await currentSeason(db);
    await db.prepare(`UPDATE seasons SET is_current = 0 WHERE is_current = 1`).run();
    await db.prepare(`UPDATE seasons SET is_current = 1 WHERE id = ?`).run(seasonId);
    await writeAudit(db, {
            actorUserId,
            action: "season_set_current",
            targetType: "season",
            targetId: seasonId,
            reason,
            meta: { before: prev?.label ?? null, after: row.label },
          });
    return { ok: true };
  })();
}
