import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  ProductionDbConfigError,
  isProductionDbRuntime,
  resolveSqlitePath,
} from "./db-path";

test("production requires explicit absolute persistent DB path", () => {
  assert.equal(isProductionDbRuntime({ NODE_ENV: "production" }), true);
  assert.equal(
    isProductionDbRuntime({ NODE_ENV: "production", BIZIM_TRIBUN_TEST: "1" }),
    false,
  );

  try {
    resolveSqlitePath({ NODE_ENV: "production" });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal((err as ProductionDbConfigError).code, "PRODUCTION_DB_PATH_MISSING");
  }

  try {
    resolveSqlitePath({ NODE_ENV: "production", BIZIM_TRIBUN_DB: ":memory:" });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal((err as ProductionDbConfigError).code, "PRODUCTION_DB_MEMORY");
  }

  try {
    resolveSqlitePath({
      NODE_ENV: "production",
      BIZIM_TRIBUN_DB: "data/bizim-tribun.db",
    });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal((err as ProductionDbConfigError).code, "PRODUCTION_DB_NOT_ABSOLUTE");
  }

  try {
    resolveSqlitePath({
      NODE_ENV: "production",
      BIZIM_TRIBUN_DB: path.join(os.tmpdir(), "bizim-tribun.db"),
    });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal((err as ProductionDbConfigError).code, "PRODUCTION_DB_EPHEMERAL");
  }

  try {
    resolveSqlitePath({
      NODE_ENV: "production",
      BIZIM_TRIBUN_DB: path.join(
        process.cwd(),
        "no-such-prod-db-parent",
        "bizim-tribun.db",
      ),
    });
    assert.fail("expected throw");
  } catch (err) {
    assert.equal((err as ProductionDbConfigError).code, "PRODUCTION_DB_PARENT_MISSING");
  }

  const okDir = path.join(process.cwd(), "data");
  fs.mkdirSync(okDir, { recursive: true });
  const okPath = path.join(okDir, "prod-path-probe.db");
  assert.equal(
    resolveSqlitePath({ NODE_ENV: "production", BIZIM_TRIBUN_DB: okPath }),
    path.resolve(okPath),
  );
});

test("development keeps default data/ path", () => {
  const resolved = resolveSqlitePath({ NODE_ENV: "development" });
  assert.ok(resolved.endsWith(`${path.sep}data${path.sep}bizim-tribun.db`));
});
