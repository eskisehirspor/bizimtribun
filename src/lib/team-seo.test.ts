import assert from "node:assert/strict";
import { test } from "node:test";
import { fanForm, seoYear } from "./team-seo";

test("fan form follows vowel harmony", () => {
  assert.equal(fanForm("Galatasaray"), "Galatasaraylı");
  assert.equal(fanForm("Fenerbahçe"), "Fenerbahçeli");
  assert.equal(fanForm("Beşiktaş"), "Beşiktaşlı");
  assert.equal(fanForm("Trabzonspor"), "Trabzonsporlu");
  assert.equal(fanForm("Eskişehirspor"), "Eskişehirsporlu");
  assert.equal(fanForm("Göztepe"), "Göztepeli");
  assert.equal(fanForm("Kasımpaşa"), "Kasımpaşalı");
  assert.equal(fanForm("Gölcük"), "Gölcüklü");
});

test("search year is the Istanbul calendar year", () => {
  assert.equal(seoYear(new Date("2026-12-31T22:30:00Z")), "2027");
  assert.equal(seoYear(new Date("2026-06-01T12:00:00Z")), "2026");
});
