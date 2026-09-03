import type Database from "better-sqlite3";
import { getCityByName, getCityBySlug } from "./cities";
import { isProvince } from "./provinces";
import { foldTr } from "./teams";
import {
  TEAM_REQUEST_MESSAGE_MAX,
  TEAM_REQUEST_MESSAGE_MIN,
  TEAM_REQUEST_NAME_MAX,
  TEAM_REQUEST_NAME_MIN,
  TEAM_REQUESTS_PER_IP_HOUR,
  TEAM_REQUESTS_PER_USER_HOUR,
} from "./policy";

export const TEAM_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type TeamRequestStatus = (typeof TEAM_REQUEST_STATUSES)[number];

export type TeamRequestInput = {
  teamName: string;
  city: string;
  message: string;
};

export type TeamRequestCreateResult =
  | { ok: true; id: number; teamName: string; city: string; status: "pending" }
  | { ok: false; error: string; status: number };

export function normalizeTeamRequestName(raw: string) {
  return foldTr(raw.replace(/\s+/g, " ").trim()).replace(/[^a-z0-9]+/g, "");
}

export function isTeamRequestRateLimited(ipCount: number, userCount: number) {
  return (
    ipCount >= TEAM_REQUESTS_PER_IP_HOUR ||
    userCount >= TEAM_REQUESTS_PER_USER_HOUR
  );
}

export function teamRequestSubmitGate(user: { id: number } | null | undefined) {
  if (!user) {
    return { ok: false as const, error: "Giriş gerekli.", status: 401 };
  }
  return { ok: true as const };
}

export function teamRequestAdminGate(user: { role?: string } | null | undefined) {
  if (!user) {
    return { ok: false as const, error: "Giriş gerekli.", status: 401 };
  }
  if (user.role !== "admin") {
    return { ok: false as const, error: "Bu işlem için yetkin yok.", status: 403 };
  }
  return { ok: true as const };
}

export function parseTeamRequestCity(raw: string) {
  const value = raw.replace(/\s+/g, " ").trim();
  if (isProvince(value)) {
    const city = getCityByName(value);
    return city ? { slug: city.slug, name: city.name } : null;
  }
  const bySlug = getCityBySlug(value);
  return bySlug ? { slug: bySlug.slug, name: bySlug.name } : null;
}

export function parseTeamRequestInput(raw: TeamRequestInput) {
  const teamName = raw.teamName.replace(/\s+/g, " ").trim();
  const message = raw.message.replace(/\r\n/g, "\n").trim();
  if (
    teamName.length < TEAM_REQUEST_NAME_MIN ||
    teamName.length > TEAM_REQUEST_NAME_MAX
  ) {
    return { ok: false as const, error: "Takım adı 3–80 karakter olmalı." };
  }
  if (!teamName.replace(/\s/g, "").length) {
    return { ok: false as const, error: "Takım adı boş olamaz." };
  }
  if (!message.replace(/\s/g, "").length) {
    return { ok: false as const, error: "Açıklama boş olamaz." };
  }
  if (
    message.length < TEAM_REQUEST_MESSAGE_MIN ||
    message.length > TEAM_REQUEST_MESSAGE_MAX
  ) {
    return { ok: false as const, error: "Açıklama 10–500 karakter olmalı." };
  }
  const city = parseTeamRequestCity(raw.city);
  if (!city) {
    return { ok: false as const, error: "Şehir listeden seçilmeli." };
  }
  return {
    ok: true as const,
    teamName,
    message,
    city,
    normalizedName: normalizeTeamRequestName(teamName),
  };
}

function findTeamByNormalizedName(db: Database.Database, normalizedName: string) {
  const rows = db
    .prepare(`SELECT id, name, is_forum_active FROM teams`)
    .all() as { id: string; name: string; is_forum_active: number }[];
  return (
    rows.find(
      (row) =>
        normalizeTeamRequestName(row.name) === normalizedName ||
        normalizeTeamRequestName(row.id) === normalizedName,
    ) ?? null
  );
}

function uniqueTeamId(db: Database.Database, normalizedName: string) {
  const base = (normalizedName || "takim").slice(0, 48);
  let id = base;
  let n = 2;
  while (
    db.prepare(`SELECT id FROM teams WHERE id = ?`).get(id) as
      | { id: string }
      | undefined
  ) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

export function createTeamRequest(
  db: Database.Database,
  userId: number,
  raw: TeamRequestInput,
): TeamRequestCreateResult {
  const parsed = parseTeamRequestInput(raw);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, status: 400 };
  }
  const existingTeam = findTeamByNormalizedName(db, parsed.normalizedName);
  if (existingTeam) {
    return {
      ok: false,
      error: existingTeam.is_forum_active
        ? "Bu takımın tribünü zaten açık."
        : "Bu takım zaten katalogda. Tribün henüz açık değil.",
      status: 409,
    };
  }

  const now = new Date().toISOString();
  try {
    const info = db
      .prepare(
        `INSERT INTO team_requests
         (requested_name, normalized_name, city_slug, message, requested_by_user_id,
          status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        parsed.teamName,
        parsed.normalizedName,
        parsed.city.slug,
        parsed.message,
        userId,
        now,
      );
    return {
      ok: true,
      id: Number(info.lastInsertRowid),
      teamName: parsed.teamName,
      city: parsed.city.name,
      status: "pending",
    };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code.includes("CONSTRAINT")) {
      return {
        ok: false,
        error: "Bu takım için zaten bekleyen talebin var.",
        status: 409,
      };
    }
    throw err;
  }
}

export function listTeamRequestGroups(
  db: Database.Database,
  filters: {
    status?: TeamRequestStatus | null;
    q?: string | null;
    citySlug?: string | null;
    offset: number;
    limit: number;
  },
) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filters.status) {
    where.push(`r.status = ?`);
    params.push(filters.status);
  }
  if (filters.citySlug) {
    where.push(`r.city_slug = ?`);
    params.push(filters.citySlug);
  }
  if (filters.q) {
    where.push(
      `(r.requested_name LIKE ? OR r.normalized_name LIKE ? OR r.city_slug LIKE ? OR r.message LIKE ? OR u.username LIKE ?)`,
    );
    params.push(filters.q, filters.q, filters.q, filters.q, filters.q);
  }
  const whereSql = where.join(" AND ");
  const total = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM (
           SELECT r.normalized_name, r.status
           FROM team_requests r
           JOIN users u ON u.id = r.requested_by_user_id
           WHERE ${whereSql}
           GROUP BY r.normalized_name, r.status
         )`,
      )
      .get(...params) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT
         MIN(r.id) as id,
         r.normalized_name as normalizedName,
         r.status as status,
         COUNT(*) as requestCount,
         MIN(r.created_at) as firstAt,
         MAX(r.created_at) as lastAt,
         MIN(r.requested_name) as requestedName,
         MIN(r.city_slug) as citySlug
       FROM team_requests r
       JOIN users u ON u.id = r.requested_by_user_id
       WHERE ${whereSql}
       GROUP BY r.normalized_name, r.status
       ORDER BY MAX(r.created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Array<{
    id: number;
    normalizedName: string;
    status: TeamRequestStatus;
    requestCount: number;
    firstAt: string;
    lastAt: string;
    requestedName: string;
    citySlug: string;
  }>;

  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      teamName: row.requestedName,
      city: getCityBySlug(row.citySlug)?.name ?? row.citySlug,
      citySlug: row.citySlug,
      requestCount: row.requestCount,
      firstAt: row.firstAt,
      lastAt: row.lastAt,
      status: row.status,
    })),
  };
}

export function getTeamRequestGroup(db: Database.Database, id: number) {
  const head = db
    .prepare(
      `SELECT id, requested_name, normalized_name, city_slug, status, created_at
       FROM team_requests WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        requested_name: string;
        normalized_name: string;
        city_slug: string;
        status: TeamRequestStatus;
        created_at: string;
      }
    | undefined;
  if (!head) return null;

  const requests = db
    .prepare(
      `SELECT r.id, r.message, r.created_at as createdAt, r.reviewed_at as reviewedAt,
              r.review_reason as reviewReason, u.id as userId, u.username
       FROM team_requests r
       JOIN users u ON u.id = r.requested_by_user_id
       WHERE r.normalized_name = ? AND r.status = ?
       ORDER BY r.created_at ASC`,
    )
    .all(head.normalized_name, head.status) as Array<{
    id: number;
    message: string;
    createdAt: string;
    reviewedAt: string | null;
    reviewReason: string | null;
    userId: number;
    username: string;
  }>;

  return {
    id: head.id,
    teamName: head.requested_name,
    city: getCityBySlug(head.city_slug)?.name ?? head.city_slug,
    citySlug: head.city_slug,
    status: head.status,
    requestCount: requests.length,
    requests: requests.map((row) => ({
      id: row.id,
      message: row.message,
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      reviewReason: row.reviewReason,
      username: row.username,
      userId: row.userId,
    })),
  };
}

function writeAudit(
  db: Database.Database,
  input: {
    moderatorUserId: number;
    targetUserId: number;
    action: string;
    reason: string | null;
  },
) {
  db.prepare(
    `INSERT INTO moderation_actions
     (moderator_user_id, target_user_id, target_topic_id, target_post_id, action, reason, created_at)
     VALUES (?, ?, NULL, NULL, ?, ?, ?)`,
  ).run(
    input.moderatorUserId,
    input.targetUserId,
    input.action,
    input.reason,
    new Date().toISOString(),
  );
}

export function approveTeamRequest(
  db: Database.Database,
  requestId: number,
  moderatorUserId: number,
  reason: string | null,
) {
  const run = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT id, requested_name, normalized_name, requested_by_user_id, status
         FROM team_requests WHERE id = ?`,
      )
      .get(requestId) as
      | {
          id: number;
          requested_name: string;
          normalized_name: string;
          requested_by_user_id: number;
          status: string;
        }
      | undefined;
    if (!row) return { ok: false as const, error: "Talep bulunamadı.", status: 404 };
    if (row.status !== "pending") {
      return { ok: false as const, error: "Bu talep zaten sonuçlanmış.", status: 409 };
    }

    let team = findTeamByNormalizedName(db, row.normalized_name);
    let created = false;
    if (!team) {
      const id = uniqueTeamId(db, row.normalized_name);
      db.prepare(
        `INSERT INTO teams (id, name, league, is_forum_active) VALUES (?, ?, 'bal', 0)`,
      ).run(id, row.requested_name);
      team = { id, name: row.requested_name, is_forum_active: 0 };
      created = true;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE team_requests
       SET status = 'approved', reviewed_at = ?, reviewed_by_user_id = ?, review_reason = ?
       WHERE normalized_name = ? AND status = 'pending'`,
    ).run(now, moderatorUserId, reason, row.normalized_name);

    writeAudit(db, {
      moderatorUserId,
      targetUserId: row.requested_by_user_id,
      action: "approve_team_request",
      reason,
    });

    return {
      ok: true as const,
      teamId: team.id,
      created,
      forumActive: Boolean(team.is_forum_active),
    };
  });
  return run();
}

export function rejectTeamRequest(
  db: Database.Database,
  requestId: number,
  moderatorUserId: number,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return { ok: false as const, error: "Red gerekçesi zorunlu.", status: 400 };
  }

  const run = db.transaction(() => {
    const row = db
      .prepare(
        `SELECT id, normalized_name, requested_by_user_id, status
         FROM team_requests WHERE id = ?`,
      )
      .get(requestId) as
      | {
          id: number;
          normalized_name: string;
          requested_by_user_id: number;
          status: string;
        }
      | undefined;
    if (!row) return { ok: false as const, error: "Talep bulunamadı.", status: 404 };
    if (row.status !== "pending") {
      return { ok: false as const, error: "Bu talep zaten sonuçlanmış.", status: 409 };
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE team_requests
       SET status = 'rejected', reviewed_at = ?, reviewed_by_user_id = ?, review_reason = ?
       WHERE normalized_name = ? AND status = 'pending'`,
    ).run(now, moderatorUserId, trimmed, row.normalized_name);

    writeAudit(db, {
      moderatorUserId,
      targetUserId: row.requested_by_user_id,
      action: "reject_team_request",
      reason: trimmed,
    });

    return { ok: true as const };
  });
  return run();
}
