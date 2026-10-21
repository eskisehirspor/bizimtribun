import assert from "node:assert/strict";
import { test } from "node:test";
import { TEAMS, teamBadge, teamShort } from "./teams";

// Codes the clubs are known by, kept even though they are not three letters.
const SHORT_EXCEPTIONS = new Set(["TS"]);

// Codes that read as slurs or insults in Turkish badges.
const BLOCKED = ["AMK", "AMQ", "SİK", "SIK", "GÖT", "PİÇ", "OÇ", "ANA", "AMI", "YAR", "SKT"];

test("every catalog team has its own three-letter code", () => {
  const seen = new Map<string, string>();
  for (const t of TEAMS) {
    if (!SHORT_EXCEPTIONS.has(t.short)) assert.equal([...t.short].length, 3, `${t.id}: ${t.short}`);
    assert.ok(!seen.has(t.short), `${t.id} and ${seen.get(t.short)} share ${t.short}`);
    assert.ok(!BLOCKED.includes(t.short), `${t.id}: ${t.short}`);
    seen.set(t.short, t.id);
  }
});

test("letters inside a name are not taken for a club suffix", () => {
  assert.equal(teamShort("eskisehirspor", "Eskişehirspor"), "ESK");
  assert.equal(teamShort("x", "Eskişehirspor"), "ESK");
  assert.equal(teamShort("x", "Kütahyaspor FSK"), "KÜT");
  assert.equal(teamShort("x", "Sivasspor"), "SİV");
  assert.equal(teamShort("x", "Mardin 1969"), "MAR");
  assert.equal(teamShort("x", "Yeni Mersin İdmanyurdu"), "YMİ");
});

test("badges: requested codes and colours, readable text on dark teams", () => {
  const byId = new Map(TEAMS.map((t) => [t.id, t]));
  assert.equal(byId.get("trabzonspor")?.short, "TS");
  assert.equal(byId.get("besiktas")?.short, "BJK");
  assert.equal(byId.get("altay")?.short, "ALT");
  for (const id of ["besiktas", "altay"]) {
    assert.deepEqual(teamBadge(byId.get(id)!), { bg: "#FFFFFF", fg: "#111111", bar: ["#FFFFFF", "#111111"] });
  }
  assert.equal(teamBadge(byId.get("fenerbahce")!).fg, "#FFFFFF");
  assert.equal(teamBadge(byId.get("galatasaray")!).fg, "#FFFFFF");
  assert.equal(teamBadge(byId.get("kayserispor")!).fg, "#FFFFFF");
  assert.equal(teamBadge({ id: "x", bleed: "#FFD100", accent: "#111111" }).fg, "#111111");
});
