import type Database from "better-sqlite3";
import { PINNED_STARTER_TOPICS } from "./forum-category";
import {
  FORUM_SYSTEM_EMAIL,
  FORUM_SYSTEM_PASSWORD_HASH,
  FORUM_SYSTEM_USERNAME,
} from "./forum-system";
import { FORUM_ACTIVE_TEAM_IDS } from "./teams";

function ensureSystemUser(db: Database.Database) {
  const existing = db
    .prepare(
      `SELECT id FROM users WHERE email_norm = ? OR username_norm = ? LIMIT 1`,
    )
    .get(FORUM_SYSTEM_EMAIL, FORUM_SYSTEM_USERNAME) as { id: number } | undefined;
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users
       (username, username_norm, display_name, email, email_norm, password_hash,
        team_id, status, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'active', 'user', ?, ?)`,
    )
    .run(
      FORUM_SYSTEM_USERNAME,
      FORUM_SYSTEM_USERNAME,
      "Tribün",
      FORUM_SYSTEM_EMAIL,
      FORUM_SYSTEM_EMAIL,
      FORUM_SYSTEM_PASSWORD_HASH,
      now,
      now,
    );
  return Number(info.lastInsertRowid);
}

export function seedPinnedStarterTopics(db: Database.Database) {
  const userId = ensureSystemUser(db);
  const now = new Date().toISOString();
  const exists = db.prepare(
    `SELECT id FROM forum_topics
     WHERE team_id = ? AND title = ? AND deleted_at IS NULL
     LIMIT 1`,
  );
  const insert = db.prepare(
    `INSERT INTO forum_topics
     (team_id, user_id, title, content, created_at, updated_at, category, is_pinned)
     VALUES (?, ?, ?, ?, ?, ?, 'anilar', 1)`,
  );

  const run = db.transaction(() => {
    for (const teamId of FORUM_ACTIVE_TEAM_IDS) {
      for (const starter of PINNED_STARTER_TOPICS) {
        if (exists.get(teamId, starter.title)) continue;
        insert.run(teamId, userId, starter.title, starter.content, now, now);
      }
    }
  });
  run();
}
