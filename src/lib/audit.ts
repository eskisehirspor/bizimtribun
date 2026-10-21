import type Database from "better-sqlite3";

/**
 * Append-only audit trail for privileged and integrity-relevant actions.
 * Never pass OTPs, passwords, tokens or phone numbers in `meta`.
 */
export function writeAudit(
  db: Database.Database,
  entry: {
    actorUserId: number | null;
    action: string;
    targetType?: string | null;
    targetId?: string | number | null;
    reason?: string | null;
    meta?: Record<string, string | number | boolean | null>;
  },
) {
  db.prepare(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, reason, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actorUserId,
    entry.action.slice(0, 64),
    entry.targetType ?? null,
    entry.targetId == null ? null : String(entry.targetId),
    entry.reason ? entry.reason.slice(0, 500) : null,
    entry.meta ? JSON.stringify(entry.meta).slice(0, 2000) : null,
    new Date().toISOString(),
  );
}

export type AuditRow = {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  meta: string | null;
  created_at: string;
};

export function listAudit(
  db: Database.Database,
  opts: { limit: number; offset: number; action?: string | null },
) {
  const where = opts.action ? `WHERE a.action = ?` : "";
  const params: (string | number)[] = opts.action ? [opts.action] : [];
  const rows = db
    .prepare(
      `SELECT a.*, u.username as actor_username
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id
       ${where}
       ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, opts.limit, opts.offset) as AuditRow[];
  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM audit_log a ${where}`).get(...params) as { c: number }
  ).c;
  return { rows, total };
}
