import assert from "node:assert/strict";
import { test } from "node:test";
import { freshTestDb, reseedTestDb } from "./db-test";
import { PROVINCES } from "./provinces";
import {
  buildReservedUsernames,
  flatUsername,
  isUsernameReserved,
  releaseReservedUsername,
  reserveUsername,
} from "./reserved-usernames";
import { TEAMS } from "./teams";

test("flatUsername folds Turkish letters and drops separators", () => {
  assert.equal(flatUsername("Kırmızı Şimşekler"), "kirmizisimsekler");
  assert.equal(flatUsername("eskisehir_spor"), "eskisehirspor");
  assert.equal(flatUsername("İnönü"), "inonu");
});

test("the list covers names, suffixes, fan forms, nicknames and cities", () => {
  const names = new Set(buildReservedUsernames(TEAMS, PROVINCES).map((r) => r.name));
  for (const name of [
    "eskisehir", "eskisehirspor", "eskisehirsporsk", "eskisehirsporlu",
    "kirmizisimsekler", "kirmizisimsek", "eses",
    "galatasarayli", "cimbom", "bjk", "fenerli", "yalovali",
    "admin", "bizimtribun", "izmir", "izmirli",
  ]) {
    assert.ok(names.has(name), name);
  }
  for (const name of names) assert.match(name, /^[a-z0-9]{3,20}$/);
});

test("reserved names block sign-up until released, and stay released on reseed", async () => {
  const db = await freshTestDb();
  assert.equal(await isUsernameReserved(db, "Eskisehir_Spor"), true);
  assert.equal(await isUsernameReserved(db, "eskisehirspor26"), false);

  assert.equal(await releaseReservedUsername(db, "eskisehirspor", 1), true);
  assert.equal(await isUsernameReserved(db, "eskisehirspor"), false);
  await reseedTestDb();
  assert.equal(await isUsernameReserved(db, "eskisehirspor"), false);

  assert.deepEqual(await reserveUsername(db, "eskisehirspor", null), { ok: true, name: "eskisehirspor" });
  assert.equal(await isUsernameReserved(db, "eskisehirspor"), true);
  assert.equal((await reserveUsername(db, "ab", null)).ok, false);
});
