import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

/**
 * The site's database: PostgreSQL on Supabase in production, an in-process
 * PGlite copy in tests and local development without DATABASE_URL.
 *
 * The shape follows the SQLite driver the site started on: prepare a
 * statement with `?` (or `@name`) placeholders, then await get/all/run.
 */

export type SqlParam = string | number | bigint | boolean | null | undefined;
/** `lastInsertRowid` is the new row's id when the table has one. */
export type RunResult = { changes: number; lastInsertRowid: number | undefined };

export interface Statement {
  get(...params: unknown[]): Promise<unknown>;
  all(...params: unknown[]): Promise<unknown[]>;
  run(...params: unknown[]): Promise<RunResult>;
}

export interface Db {
  prepare(sql: string): Statement;
  /** Runs one or more statements with no parameters. */
  exec(sql: string): Promise<void>;
  /**
   * Like better-sqlite3: wraps `fn` so each call runs in one transaction, and
   * every query inside it joins that transaction.
   */
  transaction<A extends unknown[], T>(fn: (...args: A) => Promise<T> | T): (...args: A) => Promise<T>;
}

/** What a backend has to provide; the adapter above it does the rest. */
export interface Driver {
  query(text: string, params: SqlParam[]): Promise<{ rows: unknown[]; changes: number }>;
  exec(text: string): Promise<void>;
  begin<T>(fn: (tx: Driver) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

const txStore = new AsyncLocalStorage<Driver>();

/**
 * `?` → `$1, $2…`; `@name` / `:name` with one object argument → positional.
 * Quoted strings, identifiers, `::` casts and comments are left as they are.
 */
export function toPositional(
  sql: string,
  params: unknown[],
): { text: string; values: SqlParam[] } {
  const named =
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === "object" &&
    !Array.isArray(params[0]);
  const bag = named ? (params[0] as Record<string, SqlParam>) : undefined;
  const values: SqlParam[] = [];
  const namedIndex = new Map<string, number>();
  let out = "";
  let positional = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const end = sql.indexOf(ch, i + 1);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === ":" && sql[i + 1] === ":") {
      out += "::";
      i++;
      continue;
    }
    if (ch === "?") {
      values.push(normalizeParam((params as SqlParam[])[positional++]));
      out += `$${values.length}`;
      continue;
    }
    if (bag && (ch === "@" || ch === ":" || ch === "$") && /[A-Za-z_]/.test(sql[i + 1] ?? "")) {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const name = sql.slice(i + 1, j);
      let idx = namedIndex.get(name);
      if (idx == null) {
        if (!(name in bag)) throw new Error(`Missing named parameter: ${name}`);
        values.push(normalizeParam(bag[name]));
        idx = values.length;
        namedIndex.set(name, idx);
      }
      out += `$${idx}`;
      i = j - 1;
      continue;
    }
    // camelCase aliases keep their case, as they did in SQLite.
    if (/[A-Za-z_]/.test(ch) && !/[A-Za-z0-9_$]/.test(sql[i - 1] ?? "")) {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      out += /^[a-z][a-z0-9_]*[A-Z]/.test(word) ? `"${word}"` : word;
      i = j - 1;
      continue;
    }
    out += ch;
  }
  return { text: out, values };
}

function normalizeParam(value: unknown): SqlParam {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  return value as SqlParam;
}

/** An INSERT reports the row it made, so `run()` can hand back its id. */
function withReturning(sql: string) {
  if (!/^\s*INSERT\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) return sql;
  return `${sql.trimEnd().replace(/;$/, "")} RETURNING *`;
}

function currentDriver(base: Driver): Driver {
  return txStore.getStore() ?? base;
}

export function wrapDriver(base: Driver): Db {
  return {
    prepare(sql: string): Statement {
      return {
        async get(...params) {
          const { text, values } = toPositional(sql, params);
          const { rows } = await currentDriver(base).query(text, values);
          return rows[0];
        },
        async all(...params) {
          const { text, values } = toPositional(sql, params);
          const { rows } = await currentDriver(base).query(text, values);
          return rows;
        },
        async run(...params) {
          const { text, values } = toPositional(withReturning(sql), params);
          const { rows, changes } = await currentDriver(base).query(text, values);
          const id = (rows[0] as { id?: unknown } | undefined)?.id;
          return { changes, lastInsertRowid: typeof id === "number" ? id : undefined };
        },
      };
    },
    async exec(sql: string) {
      await currentDriver(base).exec(sql);
    },
    transaction<A extends unknown[], T>(fn: (...args: A) => Promise<T> | T) {
      return async (...args: A): Promise<T> => {
        // Already inside one: join it, as nested SQLite transactions did.
        if (txStore.getStore()) return fn(...args);
        return base.begin((tx) => txStore.run(tx, async () => fn(...args)));
      };
    },
  };
}

const INT8 = 20;
const NUMERIC = 1700;

function postgresDriver(sql: postgres.Sql): Driver {
  return {
    async query(text, params) {
      const result = await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return { rows: [...result], changes: result.count ?? 0 };
    },
    async exec(text) {
      await sql.unsafe(text).simple();
    },
    async begin(fn) {
      return (await sql.begin((tx) => fn(postgresDriver(tx as unknown as postgres.Sql)))) as never;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

export function postgresClient(url: string) {
  return postgres(url, {
    // Supabase's transaction pooler and Hyperdrive do not keep prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    fetch_types: false,
    transform: { undefined: null },
    types: {
      // COUNT(*) and SUM() come back as int8/numeric; the site wants numbers.
      bigint: {
        to: INT8,
        from: [INT8, NUMERIC],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

type Factory = () => Promise<Driver>;

let testFactory: Factory | undefined;
let singleton: Promise<Driver> | undefined;
let generation = {};

/** Tests and local development plug an in-process database in here. */
export function setDriverFactoryForTests(factory: Factory | undefined) {
  testFactory = factory;
  singleton = undefined;
  generation = {};
}

/** Changes whenever tests swap in a fresh database; caches key on it. */
export function dbGeneration(): object {
  return generation;
}

function isWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

async function workersConnectionString(): Promise<string | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const bindings = env as unknown as Record<string, unknown>;
    const hyperdrive = bindings.HYPERDRIVE as { connectionString?: string } | undefined;
    return hyperdrive?.connectionString ?? (bindings.DATABASE_URL as string | undefined);
  } catch {
    return undefined;
  }
}

// On Workers a connection belongs to the request that opened it.
const perRequest = new WeakMap<object, Driver>();

async function workersDriver(): Promise<Driver> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = await getCloudflareContext({ async: true });
  const key = context.ctx as unknown as object;
  const existing = perRequest.get(key);
  if (existing) return existing;
  const url = (await workersConnectionString()) ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_MISSING");
  const client = postgresClient(url);
  const driver = postgresDriver(client);
  perRequest.set(key, driver);
  return driver;
}

async function nodeDriver(): Promise<Driver> {
  if (testFactory) return testFactory();
  if (process.env.BIZIM_TRIBUN_TEST === "1") throw new Error("Tests open their database with freshTestDb()");
  const url = process.env.DATABASE_URL?.trim();
  if (url) return postgresDriver(postgresClient(url));
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL_MISSING");
  // Local development without Supabase: a PGlite database under ./data.
  const devModule = "./db-local";
  const { localDevDriver } = (await import(/* webpackIgnore: true */ devModule)) as {
    localDevDriver: () => Promise<Driver>;
  };
  return localDevDriver();
}

async function resolveDriver(): Promise<Driver> {
  if (isWorkersRuntime() && !testFactory) return workersDriver();
  singleton ??= nodeDriver().catch((err) => {
    singleton = undefined;
    throw err;
  });
  return singleton;
}

/** A driver that finds the right connection on each call. */
const lazyDriver: Driver = {
  async query(text, params) {
    return (await resolveDriver()).query(text, params);
  },
  async exec(text) {
    return (await resolveDriver()).exec(text);
  },
  async begin(fn) {
    return (await resolveDriver()).begin(fn);
  },
};

const db = wrapDriver(lazyDriver);

export function getDb(): Db {
  return db;
}

function pgErrorCode(err: unknown) {
  return err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
}

/** A unique, foreign-key, check or not-null rule refused the write. */
export function isConstraintViolation(err: unknown) {
  return pgErrorCode(err).startsWith("23");
}

/** A unique key refused the write. */
export function isUniqueViolation(err: unknown) {
  return pgErrorCode(err) === "23505";
}

export type Participant = {
  id: number;
  email: string;
  email_norm: string;
  team_id: string;
  city: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_norm: string;
  email_hash: string | null;
  phone_hash: string | null;
  ip_hash: string;
  fingerprint_hash: string;
  consent_version: string;
  consent_at: string;
  created_at: string;
  verified_at: string | null;
  phone_verified_at: string | null;
  deleted_at: string | null;
};
