import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HSTS_VALUE,
  contentSecurityPolicy,
  isProductionNodeEnv,
  securityHeaders,
} from "./security-headers";

test("production CSP has no unsafe-eval, frames locked, object-src none", () => {
  const csp = contentSecurityPolicy(true);
  assert.equal(csp.includes("unsafe-eval"), false);
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
  assert.ok(csp.includes("form-action 'self'"));
  assert.ok(csp.includes("script-src 'self' 'unsafe-inline'"));
  assert.equal(csp.includes("ws:"), false);
});

test("development CSP allows eval and local websocket for the bundler", () => {
  const csp = contentSecurityPolicy(false);
  assert.ok(csp.includes("'unsafe-eval'"));
  assert.ok(csp.includes("connect-src 'self' ws: wss:"));
});

test("HSTS only on production header list", () => {
  const prod = securityHeaders({ production: true });
  const dev = securityHeaders({ production: false });
  assert.equal(
    prod.find((h) => h.key === "Strict-Transport-Security")?.value,
    HSTS_VALUE,
  );
  assert.equal(
    prod.find((h) => h.key === "Strict-Transport-Security")?.value?.includes(
      "preload",
    ),
    false,
  );
  assert.equal(
    dev.find((h) => h.key === "Strict-Transport-Security"),
    undefined,
  );
  assert.equal(prod.find((h) => h.key === "Referrer-Policy")?.value, "no-referrer");
  assert.equal(
    prod.find((h) => h.key === "X-Content-Type-Options")?.value,
    "nosniff",
  );
});

test("isProductionNodeEnv follows NODE_ENV", () => {
  assert.equal(isProductionNodeEnv("production"), true);
  assert.equal(isProductionNodeEnv("development"), false);
  assert.equal(isProductionNodeEnv(undefined), false);
});
