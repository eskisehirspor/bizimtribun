import type Database from "better-sqlite3";
import { CITIES } from "./cities";

/** Google sitemap protocol: max 50_000 URLs per sitemap document. */
export const SITEMAP_MAX_URLS = 50_000;

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

function origin(base: string) {
  return base.replace(/\/$/, "");
}

function parseStamp(iso: string | null | undefined) {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function staticSitemapEntries(base: string, now = new Date()): SitemapEntry[] {
  const root = origin(base);
  return [
    {
      url: root,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${root}/takimlar`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${root}/forum`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${root}/kvkk`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...CITIES.map((city) => ({
      url: `${root}/il/${city.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}

export type BoardFlags = { generalBoardOpen: boolean; cityBoardsOpen: boolean };
const ALL_BOARDS: BoardFlags = { generalBoardOpen: true, cityBoardsOpen: true };

export function publicTopicSitemapEntries(
  db: Database.Database,
  base: string,
  limit: number,
  boards: BoardFlags = ALL_BOARDS,
): SitemapEntry[] {
  if (limit <= 0) return [];
  const root = origin(base);
  const rows = db
    .prepare(
      `SELECT ft.id AS id, ft.updated_at AS updated_at
       FROM forum_topics ft
       WHERE ft.deleted_at IS NULL
         AND ft.held_at IS NULL
         AND (
           0
           ${boards.generalBoardOpen ? "OR ft.board = 'general'" : ""}
           ${boards.cityBoardsOpen ? "OR ft.board = 'city'" : ""}
         )
       ORDER BY ft.updated_at DESC, ft.id DESC
       LIMIT ?`,
    )
    .all(limit) as { id: number; updated_at: string }[];

  return rows.map((row) => {
    const lastModified = parseStamp(row.updated_at);
    return {
      url: `${root}/forum/konu/${row.id}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    };
  });
}

/** Team detail pages: active teams, plus inactive ones that still hold votes. */
export function teamPageSitemapEntries(db: Database.Database, base: string): SitemapEntry[] {
  const root = origin(base);
  const rows = db
    .prepare(
      `SELECT t.id FROM teams t
       WHERE t.is_active = 1 OR EXISTS (SELECT 1 FROM fan_votes fv WHERE fv.team_id = t.id AND fv.status = 'active')
       ORDER BY t.id`,
    )
    .all() as { id: string }[];
  return rows.map((row) => ({ url: `${root}/takim/${row.id}`, changeFrequency: "daily" as const, priority: 0.8 }));
}

/** Only profiles their owners made public; members-only profiles never appear. */
export function publicProfileSitemapEntries(db: Database.Database, base: string, limit: number): SitemapEntry[] {
  if (limit <= 0) return [];
  const root = origin(base);
  const rows = db
    .prepare(
      `SELECT username, updated_at FROM users
       WHERE profile_visibility = 'public' AND deleted_at IS NULL AND status = 'active' AND banned_at IS NULL
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(limit) as { username: string; updated_at: string }[];
  return rows.map((row) => {
    const lastModified = parseStamp(row.updated_at);
    return {
      url: `${root}/u/${row.username}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.3,
    };
  });
}

export function buildPublicSitemap(
  db: Database.Database,
  base: string,
  now = new Date(),
  boards: BoardFlags = ALL_BOARDS,
): SitemapEntry[] {
  const root = origin(base);
  const staticEntries = staticSitemapEntries(base, now);
  if (boards.generalBoardOpen) {
    staticEntries.push({ url: `${root}/forum/genel`, lastModified: now, changeFrequency: "hourly", priority: 0.7 });
  }
  const teamsPages = teamPageSitemapEntries(db, base);
  // Team tribunes are members-only, so neither their boards nor their topics are listed.
  const fixed = staticEntries.length + teamsPages.length;
  // Profiles get at most a tenth of what is left; topics take the rest.
  const profiles = publicProfileSitemapEntries(db, base, Math.floor((SITEMAP_MAX_URLS - fixed) / 10));
  const topics = publicTopicSitemapEntries(db, base, SITEMAP_MAX_URLS - fixed - profiles.length, boards);

  const entries = [...staticEntries, ...teamsPages, ...topics, ...profiles];
  const seen = new Set<string>();
  const unique: SitemapEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    unique.push(entry);
  }
  return unique;
}
