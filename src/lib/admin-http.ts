import { requireAdmin } from "./admin";
import { noStoreJson } from "./http";
import type { Permission } from "./permissions";
import { parseHeldId, parseHeldKind } from "./moderation/held";
import { ADMIN_PAGE_DEFAULT, ADMIN_PAGE_MAX } from "./policy";

export function parseAdminPage(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  let limit =
    Number(url.searchParams.get("limit") || ADMIN_PAGE_DEFAULT) || ADMIN_PAGE_DEFAULT;
  if (limit < 1) limit = ADMIN_PAGE_DEFAULT;
  if (limit > ADMIN_PAGE_MAX) limit = ADMIN_PAGE_MAX;
  return { page, limit, offset: (page - 1) * limit };
}

export function cleanAdminReason(raw: unknown) {
  if (typeof raw !== "string") return null;
  const reason = raw.trim();
  if (reason.length < 3 || reason.length > 500) return null;
  return reason;
}

export function likeQuery(raw: string | null) {
  if (!raw) return null;
  const q = raw.trim().slice(0, 80).replace(/[%_]/g, "");
  if (q.length < 1) return null;
  return `%${q}%`;
}

/** Every admin API route names the permission it needs; there is no default. */
export async function requireAdminResponse(req: Request, permission: Permission) {
  const gate = await requireAdmin(req, permission);
  if (!gate.ok) {
    return {
      ok: false as const,
      res: noStoreJson({ error: gate.error }, gate.status),
      user: null,
    };
  }
  return { ok: true as const, res: null, user: gate.user };
}

export async function requireHeldAdminAction(
  req: Request,
  ctx: { params: Promise<{ type: string; id: string }> },
) {
  const gate = await requireAdminResponse(req, "forum.moderate");
  if (!gate.ok) return { ok: false as const, res: gate.res };
  const { type, id: raw } = await ctx.params;
  const kind = parseHeldKind(type);
  if (!kind) {
    return {
      ok: false as const,
      res: noStoreJson({ error: "Geçersiz içerik tipi." }, 400),
    };
  }
  const id = parseHeldId(raw);
  if (id == null) {
    return {
      ok: false as const,
      res: noStoreJson({ error: "İçerik bulunamadı." }, 404),
    };
  }
  return { ok: true as const, res: null, user: gate.user, kind, id };
}
