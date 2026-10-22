import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Driver, SqlParam } from "./db";
import { seedSql } from "./db-seed";

export function schemaSql() {
  return fs.readFileSync(path.join(process.cwd(), "supabase", "schema.sql"), "utf8");
}

export function pgliteDriver(pg: PGlite | Parameters<Parameters<PGlite["transaction"]>[0]>[0]): Driver {
  return {
    async query(text: string, params: SqlParam[]) {
      let result;
      try {
        result = await pg.query(text, params as unknown[]);
      } catch (err) {
        if (process.env.BT_SQL_DEBUG && err instanceof Error) err.message += `\n  in: ${text}`;
        throw err;
      }
      return { rows: result.rows, changes: result.affectedRows ?? 0 };
    },
    async exec(text: string) {
      await pg.exec(text);
    },
    async begin(fn) {
      if (!("transaction" in pg)) throw new Error("NESTED_TRANSACTION");
      return (pg as PGlite).transaction((tx) => fn(pgliteDriver(tx)));
    },
  };
}

/** Opens a PGlite database with the schema and seed rows applied. */
export async function openPglite(dataDir?: string) {
  // COUNT(*) and SUM() come back as int8/numeric; the site wants numbers.
  const parsers = { 20: Number, 1700: Number };
  const pg = await PGlite.create(dataDir ? { dataDir, parsers } : { parsers });
  await pg.exec(schemaSql());
  await pg.exec(seedSql());
  return pg;
}

let local: Promise<Driver> | undefined;

/** `npm run dev` without DATABASE_URL keeps its data in ./data/pglite. */
export function localDevDriver() {
  local ??= (async () => {
    const dir = path.join(process.cwd(), "data", "pglite");
    fs.mkdirSync(dir, { recursive: true });
    return pgliteDriver(await openPglite(dir));
  })();
  return local;
}
