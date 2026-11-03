import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOG_POSTS } from "@/content/blog";
import { NATIONAL_CONTEXT, cityFacts, factKeys, teamFacts } from "@/content/fan-facts";
import { getCityByName } from "./cities";
import { getTeam } from "./teams";

test("fan facts name real teams and provinces", () => {
  const { teams, provinces } = factKeys();
  for (const id of teams) assert.ok(getTeam(id), `takım yok: ${id}`);
  for (const name of provinces) assert.ok(getCityByName(name), `il yok: ${name}`);
});

test("every fan fact has an https source and every post link is a real post", () => {
  const { teams, provinces } = factKeys();
  const sheets = [...teams.map(teamFacts), ...provinces.map(cityFacts), { facts: NATIONAL_CONTEXT, posts: [] }];
  for (const sheet of sheets) {
    for (const fact of sheet.facts) {
      assert.ok(fact.source.url.startsWith("https://"), fact.source.url);
      assert.ok(fact.value.trim().length > 0, fact.label);
    }
    for (const slug of sheet.posts) assert.ok(BLOG_POSTS.some((p) => p.slug === slug), `yazı yok: ${slug}`);
  }
});

test("a Süper Lig club gets its stadium and attendance", () => {
  const labels = teamFacts("goztepe").facts.map((f) => f.label);
  assert.ok(labels.includes("Stadı"));
  assert.ok(labels.includes("2026-27 seyirci ortalaması"));
  assert.ok(labels.includes("2025-26 seyirci ortalaması"));
  assert.deepEqual(teamFacts("yok-boyle-takim"), { facts: [], posts: [] });
});
