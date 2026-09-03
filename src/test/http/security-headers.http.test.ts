import "./env-init";
import assert from "node:assert/strict";
import { test } from "node:test";
import { GET as statsGet } from "../../app/api/stats/route";
import { GET as voteGet } from "../../app/api/vote/route";
import { POST as verifyEmail } from "../../app/api/verify/route";
import { GET as adminDashboard } from "../../app/api/admin/dashboard/route";
import { HSTS_VALUE } from "../../lib/security-headers";
import { freshDb, invoke, setNodeEnv } from "./harness";

function assertCommonSecurity(headers: Headers) {
  const csp = headers.get("content-security-policy") ?? "";
  assert.ok(csp.length > 0, "CSP missing");
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "no-referrer");
}

test("production-like API responses carry HSTS, CSP, nosniff, no-referrer", async () => {
  freshDb();
  const prev = process.env.NODE_ENV;
  setNodeEnv("production");
  try {
    const stats = await invoke(statsGet, { path: "/api/stats" });
    assert.equal(stats.status, 200);
    assertCommonSecurity(stats.headers);
    assert.equal(stats.headers.get("strict-transport-security"), HSTS_VALUE);
    const csp = stats.headers.get("content-security-policy") ?? "";
    assert.equal(csp.includes("unsafe-eval"), false);

    const vote = await invoke(voteGet, { path: "/api/vote" });
    assert.equal(vote.status, 200);
    assertCommonSecurity(vote.headers);
    assert.equal(vote.headers.get("referrer-policy"), "no-referrer");

    const verify = await invoke(verifyEmail, {
      method: "POST",
      path: "/api/verify",
      body: {},
    });
    assert.ok(verify.status >= 400);
    assert.equal(verify.headers.get("referrer-policy"), "no-referrer");
    assertCommonSecurity(verify.headers);

    const admin = await invoke(adminDashboard, { path: "/api/admin/dashboard" });
    assert.equal(admin.status, 401);
    assert.equal(admin.headers.get("referrer-policy"), "no-referrer");
    assertCommonSecurity(admin.headers);
  } finally {
    setNodeEnv(prev);
  }
});

test("development does not force HSTS", async () => {
  freshDb();
  const prev = process.env.NODE_ENV;
  setNodeEnv("development");
  try {
    const stats = await invoke(statsGet, { path: "/api/stats" });
    assert.equal(stats.status, 200);
    assert.equal(stats.headers.get("strict-transport-security"), null);
    const csp = stats.headers.get("content-security-policy") ?? "";
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("'unsafe-eval'"));
  } finally {
    setNodeEnv(prev);
  }
});
