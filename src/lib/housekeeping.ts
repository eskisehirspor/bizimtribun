import type Database from "better-sqlite3";
import { purgeExpiredAuthRows } from "./auth-otp";
import { purgeOldLegalRecords } from "./legal";
import { purgeOldNotifications } from "./notifications";

let lastRunAt = 0;

/**
 * Retention clean-up (expired codes and tickets, finished phone holds, old
 * rate-limit rows, old notifications, acceptance records of long-deleted
 * accounts). Runs at most every 10 minutes,
 * piggybacking on ordinary requests so no separate scheduler is needed.
 */
export function runHousekeepingIfDue(db: Database.Database, now = Date.now()) {
  if (now - lastRunAt < 10 * 60 * 1000) return false;
  lastRunAt = now;
  purgeExpiredAuthRows(db);
  purgeOldNotifications(db, now);
  purgeOldLegalRecords(db, now);
  return true;
}
