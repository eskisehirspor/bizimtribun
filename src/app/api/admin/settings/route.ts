import { z } from "zod";
import { requireAdminResponse } from "@/lib/admin-http";
import { getDb } from "@/lib/db";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { can } from "@/lib/permissions";
import {
  SETTING_KEYS,
  SUPER_ADMIN_KEYS,
  getSettings,
  settingsMeta,
  updateSetting,
  type SettingKey,
} from "@/lib/site-settings";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req, "content.manage");
  if (!gate.ok) return gate.res;
  const db = getDb();
  return noStoreJson({
    ok: true,
    settings: getSettings(db),
    meta: settingsMeta(db),
    canManageSystem: can(gate.user.role, "settings.manage"),
  });
}

const Body = z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), value: z.unknown() });

export async function PUT(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  const key = parsed.success ? parsed.data.key : null;
  const gate = await requireAdminResponse(
    req,
    key && SUPER_ADMIN_KEYS.has(key) ? "settings.manage" : "content.manage",
  );
  if (!gate.ok) return gate.res;
  if (!parsed.success || !key) return noStoreJson({ error: "Geçersiz ayar." }, 400);
  const result = updateSetting(getDb(), gate.user.id, key, parsed.data.value);
  if (!result.ok) return noStoreJson({ error: result.error }, result.status);
  return noStoreJson({ ok: true, key, value: result.value });
}
