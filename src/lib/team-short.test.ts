import assert from "node:assert/strict";
import { test } from "node:test";
import { TEAMS, teamShort } from "./teams";

// Codes that read as slurs or insults in Turkish badges.
const BLOCKED = ["AMK", "AMQ", "SİK", "SIK", "GÖT", "PİÇ", "OÇ", "ANA", "AMI", "YAR", "SKT"];

test("every catalog team has its own three-letter code", () => {
  const seen = new Map<string, string>();
  for (const t of TEAMS) {
    assert.equal([...t.short].length, 3, `${t.id}: ${t.short}`);
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
