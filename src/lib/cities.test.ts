import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, cityLocative, getCityBySlug } from "./cities";
import { cityCanonical, cityPageMetadata, citySeoTitle } from "./city-seo";
import { integerPercents, rankCityTeams } from "./city-rank";
import { PROVINCES } from "./provinces";

test("81 il slug route", () => {
  assert.equal(CITIES.length, 81);
  assert.equal(CITIES.length, PROVINCES.length);
  const slugs = CITIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, 81);
  assert.equal(getCityBySlug("eskisehir")?.name, "Eskişehir");
  assert.equal(getCityBySlug("bursa")?.name, "Bursa");
  assert.equal(getCityBySlug("trabzon")?.name, "Trabzon");
  assert.equal(getCityBySlug("adana")?.name, "Adana");
  assert.equal(getCityBySlug("istanbul")?.name, "İstanbul");
});

test("bilinmeyen citySlug 404", () => {
  assert.equal(getCityBySlug("atlantis"), undefined);
  assert.equal(getCityBySlug(""), undefined);
});

test("citySlug doğru ili getiriyor", () => {
  const city = getCityBySlug("eskisehir");
  assert.ok(city);
  assert.equal(city.slug, "eskisehir");
  assert.equal(city.name, "Eskişehir");
  const ranked = rankCityTeams([
    { teamId: "eskisehirspor", votes: 8 },
    { teamId: "galatasaray", votes: 2 },
  ]);
  assert.equal(ranked[0]?.teamId, "eskisehirspor");
  assert.equal(ranked[0]?.votes, 8);
  assert.equal(ranked.reduce((s, r) => s + r.votes, 0), 10);
});

test("il oranlarının toplamı doğru", () => {
  assert.deepEqual(integerPercents([]), []);
  assert.deepEqual(integerPercents([0, 0]), [0, 0]);
  const a = integerPercents([1, 1, 1]);
  assert.equal(a.reduce((s, n) => s + n, 0), 100);
  const b = integerPercents([2, 1]);
  assert.equal(b.reduce((s, n) => s + n, 0), 100);
  const ranked = rankCityTeams([
    { teamId: "galatasaray", votes: 2 },
    { teamId: "fenerbahce", votes: 1 },
    { teamId: "besiktas", votes: 1 },
  ]);
  assert.equal(
    ranked.reduce((s, r) => s + r.percent, 0),
    100,
  );
});

test("SEO metadata oluşuyor", () => {
  const city = getCityBySlug("bursa")!;
  const meta = cityPageMetadata(city);
  assert.equal(meta.title, citySeoTitle("Bursa"));
  assert.match(meta.title, /Bursa/);
  assert.match(meta.title, /Bizim Tribün/);
  assert.match(meta.description, /Bursa/);
  assert.equal(meta.alternates.canonical, cityCanonical("bursa"));
  assert.equal(meta.robots.index, true);
  assert.equal(meta.robots.follow, true);
  assert.equal(meta.openGraph.url, meta.alternates.canonical);
  assert.equal(meta.openGraph.locale, "tr_TR");
  assert.match(cityLocative("Eskişehir"), /Eskişehir'de/);
});
