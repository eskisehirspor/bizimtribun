import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class ProductionDbConfigError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ProductionDbConfigError";
  }
}

export function isDbTestRuntime(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  return env.BIZIM_TRIBUN_TEST === "1";
}

export function isProductionDbRuntime(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  return env.NODE_ENV === "production" && !isDbTestRuntime(env);
}

function isEphemeralPath(resolved: string) {
  const tmp = path.resolve(os.tmpdir());
  const rel = path.relative(tmp, resolved);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) return true;
  if (resolved === "/tmp" || resolved.startsWith("/tmp/")) return true;
  return false;
}

/**
 * Development: `BIZIM_TRIBUN_DB` or `./data/bizim-tribun.db` (created if needed).
 * Production: `BIZIM_TRIBUN_DB` must be an absolute path on persistent disk.
 */
export function resolveSqlitePath(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  const override = env.BIZIM_TRIBUN_DB?.trim();
  const production = isProductionDbRuntime(env);

  if (production) {
    if (!override) {
      throw new ProductionDbConfigError("PRODUCTION_DB_PATH_MISSING");
    }
    if (override === ":memory:" || override.toLowerCase() === ":memory:") {
      throw new ProductionDbConfigError("PRODUCTION_DB_MEMORY");
    }
    if (!path.isAbsolute(override)) {
      throw new ProductionDbConfigError("PRODUCTION_DB_NOT_ABSOLUTE");
    }
    const resolved = path.resolve(override);
    if (isEphemeralPath(resolved)) {
      throw new ProductionDbConfigError("PRODUCTION_DB_EPHEMERAL");
    }
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      throw new ProductionDbConfigError("PRODUCTION_DB_PARENT_MISSING");
    }
    return resolved;
  }

  if (override) return override;
  const dataDir = path.join(process.cwd(), "data");
  return path.join(dataDir, "bizim-tribun.db");
}

export function ensureSqliteParentDir(
  sqlitePath: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
) {
  if (sqlitePath === ":memory:") return;
  const dir = path.dirname(sqlitePath);
  if (fs.existsSync(dir)) return;
  if (isProductionDbRuntime(env)) {
    throw new ProductionDbConfigError("PRODUCTION_DB_PARENT_MISSING");
  }
  fs.mkdirSync(dir, { recursive: true });
}

export function sqliteSidecarPaths(dbPath: string) {
  return {
    wal: `${dbPath}-wal`,
    shm: `${dbPath}-shm`,
  };
}
