import type Database from "better-sqlite3";
import type { MatchedRule } from "./moderation/types";

/** Seconds a member waits between two topics or replies. */
export const FORUM_MIN_SECONDS_BETWEEN_WRITES = 15;
/** The same text can't be sent again by the same member within this window. */
export const FORUM_DUPLICATE_WINDOW_HOURS = 24;
/** Accounts younger than this have links held for a moderator. */
export const FORUM_NEW_ACCOUNT_HOURS = 24;
/** More links than this in one text are held for a moderator. */
export const FORUM_MAX_LINKS = 2;
/** Distinct open reports that hide a member's text until a moderator looks. */
export const FORUM_REPORTS_TO_HOLD = 3;

const LINK =
  /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|tr|io|xyz|me|ly|link|bet|info|biz|co|site|online|club|top|live|app|gg|tv)\b(?:\/\S*)?/gi;

export function countLinks(text: string) {
  return text.match(LINK)?.length ?? 0;
}

function sameText(text: string) {
  return text.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

/**
 * Flood and repeat guard, checked before a topic or reply is saved. Deleted
 * and held texts count too, so deleting and resending doesn't get around it.
 */
export function forumFloodCheck(
  db: Database.Database,
  userId: number,
  content: string,
  now = new Date(),
  opts: { cooldown?: boolean } = {},
): { ok: true } | { ok: false; status: number; error: string } {
  const since = new Date(now.getTime() - FORUM_DUPLICATE_WINDOW_HOURS * 3600_000).toISOString();
  const recent = db
    .prepare(
      `SELECT content, created_at FROM forum_posts WHERE user_id = ? AND created_at >= ?
       UNION ALL
       SELECT content, created_at FROM forum_topics WHERE user_id = ? AND created_at >= ?
       ORDER BY created_at DESC LIMIT 200`,
    )
    .all(userId, since, userId, since) as { content: string; created_at: string }[];

  const last = recent[0];
  // HTTP tests post many texts in a row; the cooldown itself is covered by unit tests.
  const cooldown = opts.cooldown ?? process.env.BIZIM_TRIBUN_TEST !== "1";
  if (cooldown && last && now.getTime() - Date.parse(last.created_at) < FORUM_MIN_SECONDS_BETWEEN_WRITES * 1000) {
    return { ok: false, status: 429, error: "Çok hızlı yazıyorsun. Birkaç saniye bekleyip tekrar dene." };
  }
  const text = sameText(content);
  if (recent.some((row) => sameText(row.content) === text)) {
    return { ok: false, status: 409, error: "Bu yazıyı zaten gönderdin. Aynı yazı tekrar gönderilemez." };
  }
  return { ok: true };
}

export function isNewAccount(db: Database.Database, userId: number, now = new Date()) {
  const row = db.prepare(`SELECT created_at FROM users WHERE id = ?`).get(userId) as
    | { created_at: string }
    | undefined;
  if (!row) return false;
  return now.getTime() - Date.parse(row.created_at) < FORUM_NEW_ACCOUNT_HOURS * 3600_000;
}

/** Link rules for one text; merged into the content filter's result. */
export function linkHits(text: string, newAccount: boolean): MatchedRule[] {
  const links = countLinks(text);
  if (links > FORUM_MAX_LINKS) {
    return [{ id: "spam.many-links", category: "spam", severity: "medium", action: "review" }];
  }
  if (links > 0 && newAccount) {
    return [{ id: "spam.new-account-link", category: "spam", severity: "low", action: "review" }];
  }
  return [];
}
