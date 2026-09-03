import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROBOTS_DISALLOW,
  robotsMetadata,
  robotsPathDecision,
  sitemapHasPrivatePath,
} from "./robots-policy";
import { staticSitemapEntries } from "./sitemap-policy";

test("robots output /admin disallow", () => {
  const robots = robotsMetadata("https://bizimtribun.example");
  assert.ok(robots.rules.disallow.includes("/admin"));
  assert.equal(robotsPathDecision("/admin"), "disallow");
  assert.equal(robotsPathDecision("/admin/uyeler"), "disallow");
  assert.equal(robotsPathDecision("/admin/guvenlik"), "disallow");
});

test("robots output /api/ disallow", () => {
  const robots = robotsMetadata("https://bizimtribun.example");
  assert.ok(robots.rules.disallow.includes("/api/"));
  assert.equal(robotsPathDecision("/api/vote"), "disallow");
  assert.equal(robotsPathDecision("/api/auth/me"), "disallow");
  assert.equal(robotsPathDecision("/api/otp/request"), "disallow");
});

test("auth/private route'lar disallow", () => {
  assert.equal(robotsPathDecision("/giris"), "disallow");
  assert.equal(robotsPathDecision("/giris?next=/admin"), "disallow");
  assert.equal(robotsPathDecision("/uye-ol"), "disallow");
  assert.equal(robotsPathDecision("/takim-talep"), "disallow");
  assert.equal(robotsPathDecision("/dogrula"), "disallow");
  assert.equal(robotsPathDecision("/uye-dogrula"), "disallow");
  assert.equal(robotsPathDecision("/sil-verilerim"), "disallow");
  assert.equal(
    robotsPathDecision("/takim/galatasaray/forum/yeni"),
    "disallow",
  );
  assert.equal(
    robotsPathDecision("/takim/galatasaray/forum/yeni?category=gundem"),
    "disallow",
  );
  for (const path of [
    "/admin",
    "/api/",
    "/giris",
    "/uye-ol",
    "/takim-talep",
  ] as const) {
    assert.ok(ROBOTS_DISALLOW.includes(path));
  }
});

test("/il/ allow", () => {
  assert.equal(robotsPathDecision("/il/"), "allow");
  assert.equal(robotsPathDecision("/il/istanbul"), "allow");
  assert.equal(robotsPathDecision("/il/bursa"), "allow");
});

test("/takimlar allow", () => {
  assert.equal(robotsPathDecision("/takimlar"), "allow");
});

test("public forum route'ları allow", () => {
  assert.equal(robotsPathDecision("/takim/galatasaray/forum"), "allow");
  assert.equal(robotsPathDecision("/forum/konu/12"), "allow");
  assert.equal(robotsPathDecision("/"), "allow");
  assert.equal(robotsPathDecision("/kvkk"), "allow");
});

test("sitemap private route içermiyor", () => {
  const entries = staticSitemapEntries("https://bizimtribun.example");
  const urls = entries.map((e) => e.url);
  assert.equal(sitemapHasPrivatePath(urls), false);
  assert.ok(urls.some((u) => u.endsWith("/il/istanbul") || u.includes("/il/istanbul")));
  assert.ok(urls.some((u) => u.endsWith("/takimlar")));
  assert.ok(urls.some((u) => u.endsWith("/kvkk")));
  assert.equal(urls.filter((u) => u.includes("/il/")).length, 81);
  assert.equal(
    urls.some((u) => /\/(admin|giris|uye-ol|api|takim-talep)(\/|$)/.test(u)),
    false,
  );
});
