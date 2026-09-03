import "./env-init";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as health } from "../../app/api/health/route";
import { freshDb, invoke } from "./harness";

test("GET /api/health returns ok and db healthy without PII", async () => {
  freshDb();
  const res = await invoke(health, { path: "/api/health" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { ok: true, db: "healthy" });
  const dumped = JSON.stringify(res.json);
  assert.equal(dumped.includes("email"), false);
  assert.equal(dumped.includes("token"), false);
  assert.equal(dumped.includes("bizim-tribun.db"), false);
  assert.equal(dumped.includes("BIZIM_TRIBUN"), false);
});
