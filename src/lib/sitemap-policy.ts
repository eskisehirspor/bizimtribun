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

export function activeForumSitemapEntries(
  db: Database.Database,
  base: string,
): SitemapEntry[] {
  const root = origin(base);
  const rows = db
    .prepare(
      `SELECT t.id AS team_id,
              MAX(ft.updated_at) AS last_activity
       FROM teams t
       LEFT JOIN forum_topics ft
         ON ft.team_id = t.id
        AND ft.deleted_at IS NULL
        AND ft.held_at IS NULL
       WHERE t.is_forum_active = 1
       GROUP BY t.id
       ORDER BY t.id`,
    )
    .all() as { team_id: string; last_activity: string | null }[];

  return rows.map((row) => {
    const lastModified = parseStamp(row.last_activity);
    return {
      url: `${root}/takim/${row.team_id}/forum`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "daily" as const,
      priority: 0.7,
    };
  });
}

export function publicTopicSitemapEntries(
  db: Database.Database,
  base: string,
  limit: number,
): SitemapEntry[] {
  if (limit <= 0) return [];
  const root = origin(base);
  const rows = db
    .prepare(
      `SELECT ft.id AS id, ft.updated_at AS updated_at
       FROM forum_topics ft
       INNER JOIN teams t ON t.id = ft.team_id
       WHERE t.is_forum_active = 1
         AND ft.deleted_at IS NULL
         AND ft.held_at IS NULL
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

export function buildPublicSitemap(
  db: Database.Database,
  base: string,
  now = new Date(),
): SitemapEntry[] {
  const staticEntries = staticSitemapEntries(base, now);
  const forums = activeForumSitemapEntries(db, base);
  const remaining = SITEMAP_MAX_URLS - staticEntries.length - forums.length;
  const topics = publicTopicSitemapEntries(db, base, remaining);

  const entries = [...staticEntries, ...forums, ...topics];
  const seen = new Set<string>();
  const unique: SitemapEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    unique.push(entry);
  }
  return unique;
}
