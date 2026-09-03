import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  DEV_UNRESOLVED_IP,
  PROD_UNRESOLVED_IP,
  parseIpCandidate,
  parseTrustProxyHops,
  parseTrustProxyMode,
  resolveClientIp,
  trustProxyFromEnv,
  unresolvedClientIp,
} from "./client-ip";

function hdr(init: Record<string, string>) {
  return new Headers(init);
}

function limitKey(ip: string) {
  return createHmac("sha256", "test").update(`ip:${ip}`).digest("hex");
}

test("varsayılan trust none", () => {
  assert.equal(parseTrustProxyMode(undefined), "none");
  assert.equal(parseTrustProxyMode(""), "none");
  assert.equal(parseTrustProxyMode("true"), "none");
  assert.equal(parseTrustProxyMode("cloudflare"), "cloudflare");
  assert.equal(parseTrustProxyMode("CF"), "cloudflare");
  assert.equal(parseTrustProxyMode("forwarded"), "forwarded");
  assert.equal(parseTrustProxyMode("nginx"), "forwarded");
  assert.equal(parseTrustProxyHops(undefined), 1);
  assert.equal(parseTrustProxyHops("2"), 2);
  assert.equal(parseTrustProxyHops("99"), 5);
});

test("forged X-Forwarded-For → güvenilmiyorsa yok sayılır", () => {
  const ip = resolveClientIp(
    hdr({ "x-forwarded-for": "8.8.8.8, 1.1.1.1" }),
    { mode: "none", fallback: PROD_UNRESOLVED_IP },
  );
  assert.equal(ip, PROD_UNRESOLVED_IP);
  assert.notEqual(ip, "8.8.8.8");
  assert.notEqual(ip, "1.1.1.1");
});

test("trusted proxy senaryosu → gerçek client IP doğru alınır", () => {
  const ip = resolveClientIp(
    hdr({ "x-forwarded-for": "8.8.8.8, 203.0.113.40" }),
    { mode: "forwarded", hops: 1, fallback: PROD_UNRESOLVED_IP },
  );
  assert.equal(ip, "203.0.113.40");
});

test("X-Real-IP forged → güvenilmiyorsa yok", () => {
  const ip = resolveClientIp(hdr({ "x-real-ip": "198.51.100.9" }), {
    mode: "none",
    fallback: DEV_UNRESOLVED_IP,
  });
  assert.equal(ip, DEV_UNRESOLVED_IP);
  assert.notEqual(ip, "198.51.100.9");
});

test("Cloudflare trusted durumda doğru davranış", () => {
  const ip = resolveClientIp(
    hdr({
      "x-forwarded-for": "8.8.8.8",
      "x-real-ip": "8.8.8.8",
      "cf-connecting-ip": "203.0.113.77",
    }),
    { mode: "cloudflare", fallback: PROD_UNRESOLVED_IP },
  );
  assert.equal(ip, "203.0.113.77");
});

test("Cloudflare yokken cf header forged origin'de kullanılmaz", () => {
  const ip = resolveClientIp(hdr({ "cf-connecting-ip": "203.0.113.77" }), {
    mode: "none",
    fallback: PROD_UNRESOLVED_IP,
  });
  assert.equal(ip, PROD_UNRESOLVED_IP);
});

test("local development çalışır", () => {
  assert.equal(unresolvedClientIp("development"), DEV_UNRESOLVED_IP);
  const ip = resolveClientIp(hdr({}), {
    mode: "none",
    fallback: unresolvedClientIp("development"),
  });
  assert.equal(ip, "127.0.0.1");
  const lan = parseIpCandidate("192.168.1.49");
  assert.equal(lan, "192.168.1.49");
});

test("rate limitler güvenli IP üzerinden çalışır", () => {
  const a = resolveClientIp(hdr({ "x-forwarded-for": "8.8.8.8" }), {
    mode: "none",
    fallback: PROD_UNRESOLVED_IP,
  });
  const b = resolveClientIp(hdr({ "x-forwarded-for": "1.1.1.1" }), {
    mode: "none",
    fallback: PROD_UNRESOLVED_IP,
  });
  assert.equal(a, b);
  assert.equal(limitKey(`auth-login:${a}`), limitKey(`auth-login:${b}`));

  const real = resolveClientIp(
    hdr({ "x-forwarded-for": "8.8.8.8, 203.0.113.12" }),
    { mode: "forwarded", hops: 1, fallback: PROD_UNRESOLVED_IP },
  );
  assert.equal(real, "203.0.113.12");
  assert.notEqual(limitKey(`otp:${real}`), limitKey(`otp:${PROD_UNRESOLVED_IP}`));
});

test("geçersiz header IP sayılmaz", () => {
  assert.equal(parseIpCandidate("not-an-ip"), null);
  assert.equal(parseIpCandidate("999.999.999.999"), null);
  const ip = resolveClientIp(hdr({ "cf-connecting-ip": "evil.example" }), {
    mode: "cloudflare",
    fallback: PROD_UNRESOLVED_IP,
  });
  assert.equal(ip, PROD_UNRESOLVED_IP);
});

test("forwarded hops zincirinin sağından seçer, kısa zincir fallback", () => {
  const two = resolveClientIp(
    hdr({ "x-forwarded-for": "10.0.0.1, 10.0.0.2, 203.0.113.5" }),
    { mode: "forwarded", hops: 2, fallback: PROD_UNRESOLVED_IP },
  );
  assert.equal(two, "10.0.0.2");
  const short = resolveClientIp(hdr({ "x-forwarded-for": "203.0.113.5" }), {
    mode: "forwarded",
    hops: 2,
    fallback: PROD_UNRESOLVED_IP,
  });
  assert.equal(short, PROD_UNRESOLVED_IP);
});

test("env client tarafından değiştirilemez, TRUST_PROXY server-side", () => {
  const trust = trustProxyFromEnv({
    TRUST_PROXY: "cloudflare",
    TRUST_PROXY_HOPS: "1",
    NODE_ENV: "production",
  });
  assert.equal(trust.mode, "cloudflare");
  assert.equal(trust.fallback, PROD_UNRESOLVED_IP);
  const none = trustProxyFromEnv({ NODE_ENV: "production" });
  assert.equal(none.mode, "none");
});
