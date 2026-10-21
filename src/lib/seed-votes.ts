import type Database from "better-sqlite3";

export const SEED_DOMAIN = "bizimtribun.demo";
const SEED_DOMAIN_LIKE = `%@${SEED_DOMAIN}`;

/**
 * Removes the fake ballots older development builds generated. The platform
 * no longer seeds fans or votes in any environment.
 */
export function stripDemoVotes(db: Database.Database) {
  db.prepare(
    `DELETE FROM votes WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(
    `DELETE FROM phone_otps WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(
    `DELETE FROM verify_tokens WHERE participant_id IN (
       SELECT id FROM participants WHERE email_norm LIKE ?
     )`,
  ).run(SEED_DOMAIN_LIKE);
  db.prepare(`DELETE FROM participants WHERE email_norm LIKE ?`).run(
    SEED_DOMAIN_LIKE,
  );
}
