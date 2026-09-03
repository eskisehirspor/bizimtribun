import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sqliteSidecarPaths } from "./db-path";
import { sqliteIntegrityCheck } from "./db-health";

export class DbBackupError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DbBackupError";
  }
}

const BACKUP_PREFIX = "bizim-tribun-";
const BACKUP_SUFFIX = ".sqlite";

export function backupRetentionCount(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const raw = env.DB_BACKUP_RETENTION?.trim();
  const n = raw ? Number(raw) : 7;
  if (!Number.isInteger(n) || n < 1) return 7;
  return Math.min(n, 365);
}

export function resolveBackupDir(
  dbPath: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const override = env.DB_BACKUP_DIR?.trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.resolve(override);
  }
  return path.join(path.dirname(dbPath), "backups");
}

export function backupFileName(at = new Date()) {
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${BACKUP_PREFIX}${stamp}${BACKUP_SUFFIX}`;
}

function listBackupFiles(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_SUFFIX))
    .map((name) => ({
      name,
      full: path.join(dir, name),
      mtime: fs.statSync(path.join(dir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

export function pruneBackups(dir: string, keep: number) {
  const files = listBackupFiles(dir);
  const removed: string[] = [];
  for (const extra of files.slice(Math.max(0, keep))) {
    fs.unlinkSync(extra.full);
    removed.push(extra.name);
  }
  return removed;
}

function vacuumInto(sourcePath: string, destPath: string) {
  if (!fs.existsSync(sourcePath)) {
    throw new DbBackupError("BACKUP_SOURCE_MISSING");
  }
  if (fs.existsSync(destPath)) {
    throw new DbBackupError("BACKUP_DEST_EXISTS");
  }
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const src = new Database(sourcePath, { fileMustExist: true });
  try {
    src.pragma("busy_timeout = 5000");
    const escaped = destPath.replace(/'/g, "''");
    src.exec(`VACUUM INTO '${escaped}'`);
  } catch {
    throw new DbBackupError("BACKUP_FAILED");
  } finally {
    src.close();
  }
}

export function backupSqliteFile(sourcePath: string, destPath: string) {
  vacuumInto(sourcePath, destPath);
  const check = new Database(destPath, { fileMustExist: true, readonly: true });
  try {
    if (!sqliteIntegrityCheck(check)) {
      check.close();
      fs.unlinkSync(destPath);
      throw new DbBackupError("BACKUP_INTEGRITY");
    }
  } finally {
    check.close();
  }
  return destPath;
}

export function runDailyBackup(
  sourcePath: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const dir = resolveBackupDir(sourcePath, env);
  const dest = path.join(dir, backupFileName());
  backupSqliteFile(sourcePath, dest);
  pruneBackups(dir, backupRetentionCount(env));
  return path.basename(dest);
}

function removeSqliteTree(dbPath: string) {
  const { wal, shm } = sqliteSidecarPaths(dbPath);
  for (const file of [dbPath, wal, shm]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

export function restoreSqliteFile(backupPath: string, targetPath: string) {
  if (!fs.existsSync(backupPath)) {
    throw new DbBackupError("RESTORE_SOURCE_MISSING");
  }
  const parent = path.dirname(targetPath);
  if (!fs.existsSync(parent)) {
    throw new DbBackupError("RESTORE_PARENT_MISSING");
  }

  const safetyDir = path.join(parent, "restore-safety");
  if (fs.existsSync(targetPath)) {
    fs.mkdirSync(safetyDir, { recursive: true });
    const safety = path.join(safetyDir, backupFileName(new Date()));
    backupSqliteFile(targetPath, safety);
  }

  const tmp = `${targetPath}.restore-tmp`;
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  vacuumInto(backupPath, tmp);

  const check = new Database(tmp, { fileMustExist: true, readonly: true });
  try {
    if (!sqliteIntegrityCheck(check)) {
      check.close();
      fs.unlinkSync(tmp);
      throw new DbBackupError("RESTORE_INTEGRITY");
    }
  } finally {
    check.close();
  }

  removeSqliteTree(targetPath);
  fs.renameSync(tmp, targetPath);
}
