import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GET as getSettingsRoute, PUT as putSetting } from "../../app/api/admin/settings/route";
import { GET as dashboard } from "../../app/api/admin/dashboard/route";
import { GET as site } from "../../app/api/site/route";
import { GET as listGeneral, POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { getDb } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/site-settings";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(async () => {
  await freshDb();
  invalidateSettingsCache();
});

let n = 0;
async function member(role: "user" | "moderator" | "admin" | "super_admin" = "user") {
  n += 1;
  const u = await smsSignup({ phone: trPhone(9100 + n), username: uniq("st").slice(0, 20), ip: `203.0.113.${n % 250}` });
  if (role !== "user") await getDb().prepare(`UPDATE users SET role = ?, totp_enabled = 1 WHERE id = ?`).run(role, u.id);
  return u;
}

function put(cookie: string, key: string, value: unknown) {
  return invoke(putSetting, { method: "PUT", path: "/api/admin/settings", cookie, body: { key, value } });
}

const TOPIC = { title: "Bakım günü konusu", content: "Bu yazı bakımda gitmemeli." };

test("content settings need admin; maintenance and flags need super admin", async () => {
  const mod = await member("moderator");
  const admin = await member("admin");
  const sup = await member("super_admin");
  const ann = { active: true, text: "Derbi haftası!", tone: "info", link: "/forum" };

  assert.equal((await invoke(getSettingsRoute, { path: "/api/admin/settings", cookie: mod.cookie })).status, 403);
  assert.equal((await put(mod.cookie, "announcement", ann)).status, 403);
  assert.equal((await put(admin.cookie, "announcement", ann)).status, 200);
  assert.equal((await put(admin.cookie, "maintenance", { enabled: true, message: "x" })).status, 403);
  assert.equal((await put(sup.cookie, "maintenance", { enabled: false, message: "" })).status, 200);

  const audit = await getDb()
      .prepare(`SELECT action FROM audit_log WHERE action LIKE 'setting_%' ORDER BY id`)
      .all() as { action: string }[];
  assert.deepEqual(audit.map((a) => a.action), ["setting_announcement", "setting_maintenance"]);

  const pub = await invoke(site, { path: "/api/site" });
  assert.equal((pub.json as { announcement: { text: string } }).announcement.text, "Derbi haftası!");
  // Denied attempts by signed-in members are counted on the dashboard.
  const dash = await invoke(dashboard, { path: "/api/admin/dashboard", cookie: admin.cookie });
  assert.equal(dash.status, 200);
  assert.ok((dash.json as { suspicious: { deniedAdminAttempts: number } }).suspicious.deniedAdminAttempts >= 2);
});

test("unsafe links and markup are rejected or neutralised", async () => {
  const admin = await member("admin");
  for (const link of ["javascript:alert(1)", "//evil.example", "http://plain.example", "data:text/html,x"]) {
    const res = await put(admin.cookie, "announcement", { active: true, text: "x", tone: "info", link });
    assert.equal(res.status, 400, link);
  }
  const res = await put(admin.cookie, "announcement", {
    active: true,
    text: "<script>alert(1)</script>Merhaba",
    tone: "info",
    link: "",
  });
  assert.equal(res.status, 200);
  assert.equal((res.json as { value: { text: string } }).value.text.includes("<"), false);
  assert.equal((await put(admin.cookie, "socialLinks", { x: "javascript:x", instagram: "", youtube: "", tiktok: "" })).status, 400);
  assert.equal((await put(admin.cookie, "featuredTopics", { ids: [999999] })).status, 400);
  assert.equal((await put(admin.cookie, "nope", {})).status, 400);
});

test("maintenance makes the site read-only for members but not staff", async () => {
  const sup = await member("super_admin");
  const fan = await member();
  assert.equal((await put(sup.cookie, "maintenance", { enabled: true, message: "Kısa bakım" })).status, 200);

  const blocked = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: fan.cookie, body: TOPIC });
  assert.equal(blocked.status, 503);
  assert.equal((await invoke(listGeneral, { path: "/api/forum/genel/topics" })).status, 200);
  const staff = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: sup.cookie, body: TOPIC });
  assert.equal(staff.status, 201, staff.text);
  await assert.rejects(member(),
    /signup 503/,
  );
});

test("feature flags close boards, likes and sign-ups", async () => {
  const sup = await member("super_admin");
  const fan = await member();
  const other = await member();
  const created = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: fan.cookie, body: TOPIC });
  const id = (created.json as { topic: { id: number } }).topic.id;

  const flags = { signupsOpen: false, teamRequestsOpen: true, likesEnabled: false, generalBoardOpen: false };
  assert.equal((await put(sup.cookie, "features", flags)).status, 200);
  assert.equal((await invoke(listGeneral, { path: "/api/forum/genel/topics" })).status, 404);
  const liked = await invoke(like, { method: "POST", path: "/api/forum/likes", cookie: other.cookie, body: { type: "topic", id, liked: true } });
  assert.equal(liked.status, 403);
  // Refused at the code check, before the sign-up form.
  await assert.rejects(member(), /otp verify 403/);

  // Content is kept: reopening the board brings it back.
  assert.equal((await put(sup.cookie, "features", { ...flags, generalBoardOpen: true })).status, 200);
  const list = await invoke(listGeneral, { path: "/api/forum/genel/topics" });
  assert.deepEqual((list.json as { topics: { id: number }[] }).topics.map((t) => t.id), [id]);
});

test("opening data shows on the home stats only, labelled, and an admin can turn it off", async () => {
  const { GET: stats } = await import("../../app/api/stats/route");
  const { teamSummary, totalVerified } = await import("@/lib/stats");
  const admin = await member("admin");
  const sup = await member("super_admin");
  type Stats = { total: number; opening: number; teams: { id: string; votes: number }[]; cities: Record<string, { teamId: string; tied: boolean }> };
  const read = async () => (await invoke(stats, { path: "/api/stats" })).json as Stats;

  // Off by default: the numbers are the real ones.
  const real = await totalVerified();
  assert.equal((await read()).opening, 0);
  assert.equal((await read()).total, real);

  assert.equal((await put(admin.cookie, "openingData", { enabled: true })).status, 403);
  assert.equal((await put(sup.cookie, "openingData", { enabled: true })).status, 200);
  invalidateSettingsCache();
  const on = await read();
  assert.ok(on.opening > 0);
  assert.equal(on.total, real + on.opening);
  assert.equal(on.cities["Eskişehir"]?.teamId, "eskisehirspor");
  assert.equal(on.cities["Trabzon"]?.teamId, "trabzonspor");
  assert.equal(on.teams.find((t) => t.id === "eskisehirspor")?.votes, 5);
  assert.ok(on.teams.every((t) => t.votes >= 1));
  for (const [city, team] of [["Bursa", "bursaspor"], ["Sakarya", "sakaryaspor"], ["Kocaeli", "kocaelispor"], ["İzmir", "goztepe"], ["Ankara", "galatasaray"], ["Yozgat", "fenerbahce"], ["Ardahan", "besiktas"], ["İstanbul", "galatasaray"]]) {
    assert.equal(on.cities[city]?.teamId, team, city);
    assert.equal(on.cities[city]?.tied, false, city);
  }
  // Every province is coloured.
  assert.equal(Object.keys(on.cities).length, 81);

  // Nothing written as votes; SEO-facing numbers stay real.
  assert.equal(await totalVerified(), real);
  assert.equal((await teamSummary("eskisehirspor"))?.votes, 0);

  assert.equal((await put(sup.cookie, "openingData", { enabled: false })).status, 200);
  invalidateSettingsCache();
  assert.equal((await read()).opening, 0);
});
