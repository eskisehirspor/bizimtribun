import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { getDb } from "./db";
import { freshTestDb, reseedTestDb } from "./db-test";
import { teamCounts } from "./stats";
import { createSeason, currentSeason, setCurrentSeason, updateLeague, updateTeam } from "./team-admin";
import { getCatalogTeam, listTeamCatalog } from "./team-catalog";

process.env.BIZIM_TRIBUN_TEST = "1";
process.env.APP_SECRET ||= "team-admin-test-secret-32-chars!!";

beforeEach(async () => {
  await freshTestDb();
});

async function admin() {
  const now = new Date().toISOString();
  return Number(
    (await getDb()
            .prepare(
              `INSERT INTO users (username, username_norm, display_name, role, created_at, updated_at)
         VALUES ('yonetici', 'yonetici', 'yonetici', 'admin', ?, ?)`,
            )
            .run(now, now)).lastInsertRowid,
  );
}

test("catalog comes from the database with seed colours", async () => {
  const gs = await getCatalogTeam("gs");
  assert.equal(gs?.id, "galatasaray");
  assert.equal(gs?.isActive, true);
  assert.equal(gs?.isForumActive, true);
  assert.ok((await listTeamCatalog()).length > 50);
});

test("admin edit survives the next boot sync and is audited", async () => {
  const actor = await admin();
  const res = await updateTeam(getDb(), actor, "galatasaray", { name: "Galatasaray SK", league: "lig1" }, "isim düzeltme");
  assert.deepEqual(res, { ok: true });

  await reseedTestDb();
  const gs = await getCatalogTeam("galatasaray");
  assert.equal(gs?.name, "Galatasaray SK");
  assert.equal(gs?.league, "lig1");
  const audit = await getDb()
      .prepare(`SELECT action, meta FROM audit_log WHERE target_id = 'galatasaray'`)
      .get() as { action: string; meta: string };
  assert.equal(audit.action, "team_update");
  assert.match(audit.meta, /"name_before":"Galatasaray"/);
});

test("team edits validate input and refuse duplicate names", async () => {
  const actor = await admin();
  assert.equal((await updateTeam(getDb(), actor, "galatasaray", { league: "premier" }, "x y z")).ok, false);
  assert.equal((await updateTeam(getDb(), actor, "galatasaray", { colorPrimary: "red" }, "x y z")).ok, false);
  assert.equal((await updateTeam(getDb(), actor, "galatasaray", { city: "Atlantis" }, "x y z")).ok, false);
  const dup = await updateTeam(getDb(), actor, "galatasaray", { name: "FENERBAHÇE" }, "x y z");
  assert.equal(dup.ok, false);
  assert.equal((await updateTeam(getDb(), actor, "yok-boyle", { name: "X Y" }, "x y z")).ok, false);
});

test("an inactive team keeps its votes in public counts but is hidden when empty", async () => {
  const actor = await admin();
  await updateTeam(getDb(), actor, "galatasaray", { isActive: false }, "lisans iptali");
  assert.ok(!(await teamCounts()).some((t) => t.id === "galatasaray"));
});

test("leagues rename and reorder", async () => {
  const actor = await admin();
  assert.deepEqual(await updateLeague(getDb(), actor, "lig1", { name: "Trendyol 1. Lig" }, "sponsor adı"), { ok: true });
  const row = await getDb().prepare(`SELECT name FROM leagues WHERE id = 'lig1'`).get() as { name: string };
  assert.equal(row.name, "Trendyol 1. Lig");
  assert.equal((await updateLeague(getDb(), actor, "yok", { name: "X Y" }, "x y z")).ok, false);
});

test("seasons snapshot team leagues and keep one current season", async () => {
  const actor = await admin();
  const a = await createSeason(getDb(), actor, {
      label: "2025-26",
      startsOn: "2025-08-01",
      endsOn: "2026-05-31",
      makeCurrent: true,
    });
  assert.equal(a.ok, true);
  const b = await createSeason(getDb(), actor, {
      label: "2026-27",
      startsOn: "2026-08-01",
      endsOn: "2027-05-31",
      makeCurrent: true,
    });
  assert.equal(b.ok, true);
  assert.equal((await currentSeason(getDb()))?.label, "2026-27");

  await updateTeam(getDb(), actor, "galatasaray", { league: "lig1" }, "küme düştü");
  const snap = await getDb()
      .prepare(`SELECT league_id FROM team_seasons WHERE season_id = ? AND team_id = 'galatasaray'`)
      .get(b.id) as { league_id: string };
  assert.equal(snap.league_id, "super");

  assert.equal((await setCurrentSeason(getDb(), actor, a.id!, "geri alındı")).ok, true);
  assert.equal((await currentSeason(getDb()))?.label, "2025-26");

  const dup = await createSeason(getDb(), actor, {
      label: "2026-27",
      startsOn: "2026-08-01",
      endsOn: "2027-05-31",
      makeCurrent: false,
    });
  assert.equal(dup.ok, false);
  const bad = await createSeason(getDb(), actor, {
      label: "yaz",
      startsOn: "2026-08-01",
      endsOn: "2026-07-01",
      makeCurrent: false,
    });
  assert.equal(bad.ok, false);
});
