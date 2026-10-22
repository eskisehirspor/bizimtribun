import type { Db } from "./db";
import { z } from "zod";
import { writeAudit } from "./audit";
import { dbGeneration, getDb } from "./db";
import { LEAGUE_ORDER } from "./teams";

/**
 * Site settings edited from /admin/ayarlar. Values are plain text, URLs and
 * flags only: nothing here is rendered as HTML or executed, so a setting
 * cannot inject markup or script into the site.
 *
 * Content keys (announcement, featured topics, social links, SEO texts, home
 * leagues) need `content.manage` (admin). Maintenance and feature flags need
 * `settings.manage` (super admin).
 */

const plain = (max: number) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => s.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max));

/** https:// links or same-site paths only (no javascript:, data:, //host). */
const safeLink = z
  .string()
  .max(300)
  .transform((s) => s.trim())
  .refine((s) => s === "" || /^https:\/\/[^\s<>"']+$/i.test(s) || /^\/(?!\/)[^\s<>"'\\]*$/.test(s), {
    message: "Bağlantı https:// ile ya da / ile başlamalı.",
  });

const httpsOnly = z
  .string()
  .max(300)
  .transform((s) => s.trim())
  .refine((s) => s === "" || /^https:\/\/[^\s<>"']+$/i.test(s), { message: "Bağlantı https:// ile başlamalı." });

export const SETTING_SCHEMAS = {
  announcement: z.object({
    active: z.boolean(),
    text: plain(200),
    tone: z.enum(["info", "warning"]),
    link: safeLink,
  }),
  featuredTopics: z.object({ ids: z.array(z.number().int().positive()).max(5) }),
  socialLinks: z.object({ x: httpsOnly, instagram: httpsOnly, youtube: httpsOnly, tiktok: httpsOnly }),
  seo: z.object({ siteTitle: plain(70), siteDescription: plain(160) }),
  homeLeagues: z.object({ ids: z.array(z.enum(LEAGUE_ORDER as [string, ...string[]])).min(1).max(5) }),
  maintenance: z.object({ enabled: z.boolean(), message: plain(200) }),
  features: z.object({
    signupsOpen: z.boolean(),
    teamRequestsOpen: z.boolean(),
    likesEnabled: z.boolean(),
    generalBoardOpen: z.boolean(),
  }),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
export type Settings = { [K in SettingKey]: z.output<(typeof SETTING_SCHEMAS)[K]> };
export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export const SUPER_ADMIN_KEYS: ReadonlySet<SettingKey> = new Set(["maintenance", "features"]);

export const DEFAULT_SETTINGS: Settings = {
  announcement: { active: false, text: "", tone: "info", link: "" },
  featuredTopics: { ids: [] },
  socialLinks: { x: "", instagram: "", youtube: "", tiktok: "" },
  seo: {
    siteTitle: "Taraftar Sayısı: Hangi Takımın Kaç Taraftarı Var? | Bizim Tribün",
    siteDescription:
      "Türkiye'nin en büyük takımı hangisi, hangi takımın kaç taraftarı var? Doğrulanmış hesap başına tek oyla gerçek taraftar sayımı ve il il tribün haritası.",
  },
  homeLeagues: { ids: [...LEAGUE_ORDER] },
  maintenance: { enabled: false, message: "" },
  features: {
    signupsOpen: true,
    teamRequestsOpen: true,
    likesEnabled: true,
    generalBoardOpen: true,
  },
};

const CACHE_MS = 15_000;
let cache = new WeakMap<object, { at: number; value: Settings }>();

async function readAll(db: Db): Promise<Settings> {
  const rows = await db.prepare(`SELECT key, value FROM site_settings`).all() as { key: string; value: string }[];
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    if (!(row.key in SETTING_SCHEMAS)) continue;
    const key = row.key as SettingKey;
    try {
      const parsed = SETTING_SCHEMAS[key].safeParse(JSON.parse(row.value));
      // A stored value that no longer validates falls back to the default.
      if (parsed.success) (out as Record<SettingKey, unknown>)[key] = parsed.data;
    } catch {
      // keep default
    }
  }
  return out;
}

export async function getSettings(db: Db = getDb()): Promise<Settings> {
  const key = db === getDb() ? dbGeneration() : db;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await readAll(db);
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function invalidateSettingsCache() {
  cache = new WeakMap();
}

export async function updateSetting(
  db: Db,
  actorUserId: number,
  key: SettingKey,
  input: unknown,
): Promise<{ ok: true; value: Settings[SettingKey] } | { ok: false; error: string; status: number }> {
  const parsed = SETTING_SCHEMAS[key].safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz ayar.", status: 400 };
  }
  const value = parsed.data;
  if (key === "featuredTopics") {
    const ids = (value as Settings["featuredTopics"]).ids;
    for (const id of ids) {
      const t = await db
              .prepare(`SELECT board FROM forum_topics WHERE id = ? AND deleted_at IS NULL AND held_at IS NULL`)
              .get(id) as { board: string } | undefined;
      if (!t) return { ok: false, error: `#${id} numaralı yayında bir konu yok.`, status: 400 };
      if (t.board === "team") {
        return { ok: false, error: `#${id} bir takım tribünü konusu; takım tribünleri yalnızca taraftarlarına açık.`, status: 400 };
      }
    }
  }
  const now = new Date().toISOString();
  await db.transaction(async () => {
        await db.prepare(
                `INSERT INTO site_settings (key, value, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
         updated_by_user_id = excluded.updated_by_user_id`,
              ).run(key, JSON.stringify(value), now, actorUserId);
        await writeAudit(db, {
                actorUserId,
                action: `setting_${key}`,
                targetType: "setting",
                targetId: key,
                meta: { value: JSON.stringify(value).slice(0, 1500) },
              });
      })();
  invalidateSettingsCache();
  return { ok: true, value };
}

export async function settingsMeta(db: Db) {
  return await db
      .prepare(
        `SELECT s.key, s.updated_at as updatedAt, u.username as updatedBy
       FROM site_settings s LEFT JOIN users u ON u.id = s.updated_by_user_id`,
      )
      .all() as { key: string; updatedAt: string; updatedBy: string | null }[];
}

export const MAINTENANCE_ERROR = "Site bakımda; şu an yalnızca okunabiliyor. Biraz sonra tekrar dene.";

/** Read-only maintenance applies to members; staff can still work. */
export async function maintenanceBlocks(role: string | null | undefined) {
  const { maintenance } = await getSettings();
  return maintenance.enabled && (role ?? "user") === "user";
}
