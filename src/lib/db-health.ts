import type Database from "better-sqlite3";

export function sqliteQuickCheck(db: Database.Database) {
  const result = db.pragma("quick_check", { simple: true });
  return result === "ok";
}

export function sqliteIntegrityCheck(db: Database.Database) {
  const result = db.pragma("integrity_check", { simple: true });
  return result === "ok";
}

export function sqlitePing(db: Database.Database) {
  db.prepare("SELECT 1").get();
}

export function evaluateDbHealth(db: Database.Database) {
  try {
    sqlitePing(db);
    if (!sqliteQuickCheck(db)) return false;
    return true;
  } catch {
    return false;
  }
}
