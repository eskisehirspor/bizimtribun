import { PINNED_STARTER_TOPICS } from "./forum-category";
import {
  FORUM_SYSTEM_EMAIL,
  FORUM_SYSTEM_PASSWORD_HASH,
  FORUM_SYSTEM_USERNAME,
} from "./forum-system";
import { CURRENT_POLL_ID } from "./policy";
import { PROVINCES } from "./provinces";
import { buildReservedUsernames } from "./reserved-usernames";
import { FORUM_ACTIVE_TEAM_IDS, LEAGUE_LABEL, LEAGUE_ORDER, TEAMS } from "./teams";

function lit(value: string | number | null): string {
  if (value == null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The rows every database starts with: leagues, the team catalog, the forum's
 * system account, its pinned starter topics and the reserved usernames. Safe
 * to run again: the code catalog refreshes teams no admin has edited, and
 * nothing is duplicated.
 */
export function seedSql(now = new Date().toISOString()): string {
  const out: string[] = [];

  out.push(
    `INSERT INTO polls (id, title, created_at) VALUES (${lit(CURRENT_POLL_ID)}, 'Türkiye tribün sayımı', ${lit(now)})
ON CONFLICT (id) DO NOTHING;`,
  );

  out.push(
    `INSERT INTO leagues (id, name, sort_order, updated_at) VALUES
${LEAGUE_ORDER.map((id, i) => `  (${lit(id)}, ${lit(LEAGUE_LABEL[id])}, ${i}, ${lit(now)})`).join(",\n")}
ON CONFLICT (id) DO NOTHING;`,
  );

  // Once an admin changes a team in the panel, that row is theirs.
  const forumActive = new Set(FORUM_ACTIVE_TEAM_IDS);
  out.push(
    `INSERT INTO teams (id, name, league, city, color_primary, color_secondary, is_forum_active) VALUES
${TEAMS.map(
  (t) =>
    `  (${lit(t.id)}, ${lit(t.name)}, ${lit(t.league)}, ${lit(t.city)}, ${lit(t.bleed)}, ${lit(t.accent)}, ${forumActive.has(t.id) ? 1 : 0})`,
).join(",\n")}
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name, league = excluded.league, city = excluded.city,
  color_primary = excluded.color_primary, color_secondary = excluded.color_secondary,
  is_forum_active = excluded.is_forum_active
WHERE teams.admin_edited_at IS NULL;`,
  );

  out.push(
    `INSERT INTO users
  (username, username_norm, display_name, email, email_norm, password_hash,
   team_id, status, role, created_at, updated_at)
SELECT ${lit(FORUM_SYSTEM_USERNAME)}, ${lit(FORUM_SYSTEM_USERNAME)}, 'Tribün', ${lit(FORUM_SYSTEM_EMAIL)},
  ${lit(FORUM_SYSTEM_EMAIL)}, ${lit(FORUM_SYSTEM_PASSWORD_HASH)}, NULL, 'active', 'user', ${lit(now)}, ${lit(now)}
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email_norm = ${lit(FORUM_SYSTEM_EMAIL)} OR username_norm = ${lit(FORUM_SYSTEM_USERNAME)}
);`,
  );

  const teamRows = FORUM_ACTIVE_TEAM_IDS.map((id, i) => `(${lit(id)}, ${i})`).join(", ");
  const starterRows = PINNED_STARTER_TOPICS.map(
    (s, i) => `(${lit(s.title)}, ${lit(s.content)}, ${i})`,
  ).join(",\n    ");
  out.push(
    `INSERT INTO forum_topics (team_id, user_id, title, content, created_at, updated_at, category, is_pinned)
SELECT t.id, u.id, s.title, s.content, ${lit(now)}, ${lit(now)}, 'kulup-tarihi', 1
FROM users u
CROSS JOIN (VALUES ${teamRows}) AS t(id, ord)
CROSS JOIN (VALUES
    ${starterRows}) AS s(title, content, ord)
WHERE u.email_norm = ${lit(FORUM_SYSTEM_EMAIL)}
  AND NOT EXISTS (
    SELECT 1 FROM forum_topics f
    WHERE f.team_id = t.id AND f.title = s.title AND f.deleted_at IS NULL
  )
ORDER BY t.ord, s.ord;`,
  );

  // A name an admin released stays released: existing rows are left alone.
  out.push(
    `INSERT INTO reserved_usernames (name, kind, team_id, note, created_at) VALUES
${buildReservedUsernames(TEAMS, PROVINCES)
  .map((r) => `  (${lit(r.name)}, ${lit(r.kind)}, ${lit(r.teamId)}, ${lit(r.note)}, ${lit(now)})`)
  .join(",\n")}
ON CONFLICT (name) DO NOTHING;`,
  );

  return out.join("\n\n") + "\n";
}
