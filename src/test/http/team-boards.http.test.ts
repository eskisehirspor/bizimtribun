import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as createTeamTopic } from "../../app/api/forum/teams/[teamSlug]/topics/route";
import { POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { POST as createPost } from "../../app/api/forum/topics/[topicId]/posts/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { POST as report } from "../../app/api/forum/reports/route";
import { GET as notifications } from "../../app/api/notifications/route";
import { GET as activity } from "../../app/api/users/[username]/activity/route";
import { GET as getProfile, PATCH as patchProfile } from "../../app/api/account/profile/route";
import { PUT as putSetting } from "../../app/api/admin/settings/route";
import { getDb } from "@/lib/db";
import { recentPublicTopics } from "@/lib/home-feed";
import { invalidateSettingsCache } from "@/lib/site-settings";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(() => {
  freshDb();
  invalidateSettingsCache();
});

let n = 0;
async function member(teamId = "galatasaray", role: "user" | "moderator" | "admin" | "super_admin" = "user") {
  n += 1;
  const u = await smsSignup({ phone: trPhone(7100 + n), username: uniq("tb").slice(0, 20), teamId, ip: `198.51.100.${n % 250}` });
  if (role !== "user") getDb().prepare(`UPDATE users SET role = ?, totp_enabled = 1 WHERE id = ?`).run(role, u.id);
  return u;
}

const TOPIC = { title: "Derbi öncesi kadro", content: "İlk on bir nasıl olmalı, yazın." };
let seq = 0;
/** The same text can't be sent twice, so each topic gets its own. */
function topicBody() {
  seq += 1;
  return { ...TOPIC, content: `${TOPIC.content} (${seq})` };
}

async function teamTopic(cookie: string, team = "galatasaray") {
  const res = await invoke(createTeamTopic, {
    method: "POST",
    path: `/api/forum/teams/${team}/topics`,
    params: { teamSlug: team },
    cookie,
    body: topicBody(),
  });
  assert.equal(res.status, 201, res.text);
  return (res.json as { topic: { id: number } }).topic.id;
}

type Note = { kind: string; topicId: number | null; body: string };
async function inbox(cookie: string) {
  const res = await invoke(notifications, { path: "/api/notifications", cookie });
  assert.equal(res.status, 200, res.text);
  return (res.json as { items: Note[] }).items.filter((x) => x.kind !== "badge");
}

test("admins get a notice for every new topic; members and moderators do not; admins can opt out", async () => {
  const admin = await member("galatasaray", "admin");
  const sup = await member("fenerbahce", "super_admin");
  const mod = await member("galatasaray", "moderator");
  const fan = await member();

  const id = await teamTopic(fan.cookie);
  for (const who of [admin, sup]) {
    const notes = await inbox(who.cookie);
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.kind, "system");
    assert.equal(notes[0]!.topicId, id);
    assert.match(notes[0]!.body, /yeni konu açtı/);
  }
  assert.equal((await inbox(mod.cookie)).length, 0);
  assert.equal((await inbox(fan.cookie)).length, 0);

  // An admin's own topic does not notify them.
  const general = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie: admin.cookie, body: topicBody() });
  assert.equal(general.status, 201);
  assert.equal((await inbox(admin.cookie)).length, 1);
  assert.equal((await inbox(sup.cookie)).length, 2);

  // Opt-out is admin-only; a member can't set it.
  const memberSettings = await invoke(getProfile, { path: "/api/account/profile", cookie: fan.cookie });
  assert.equal((memberSettings.json as { settings: { notifyNewTopics: unknown } }).settings.notifyNewTopics, null);
  const off = await invoke(patchProfile, {
    method: "PATCH",
    path: "/api/account/profile",
    cookie: sup.cookie,
    body: { notifyNewTopics: false },
  });
  assert.equal(off.status, 200, off.text);
  await teamTopic(fan.cookie);
  assert.equal((await inbox(sup.cookie)).length, 2);
  assert.equal((await inbox(admin.cookie)).length, 2);
});

test("team topics stay inside the tribune: home feed, featured, profile activity, likes, reports, mentions", async () => {
  const fan = await member();
  const mate = await member();
  const rival = await member("fenerbahce");
  const sup = await member("besiktas", "super_admin");
  const id = await teamTopic(fan.cookie);

  assert.equal(recentPublicTopics().some((t) => t.id === id), false);
  const featured = await invoke(putSetting, {
    method: "PUT",
    path: "/api/admin/settings",
    cookie: sup.cookie,
    body: { key: "featuredTopics", value: { ids: [id] } },
  });
  assert.equal(featured.status, 400);

  const items = async (cookie?: string) => {
    const res = await invoke(activity, {
      path: `/api/users/${fan.username}/activity`,
      params: { username: fan.username },
      cookie,
    });
    assert.equal(res.status, 200, res.text);
    return (res.json as { items: { topicId: number }[] }).items.map((i) => i.topicId);
  };
  assert.deepEqual(await items(mate.cookie), [id]);
  assert.deepEqual(await items(rival.cookie), []);
  assert.deepEqual(await items(sup.cookie), [id]);

  const rivalLike = await invoke(like, {
    method: "POST",
    path: "/api/forum/likes",
    cookie: rival.cookie,
    body: { type: "topic", id, liked: true },
  });
  assert.equal(rivalLike.status, 404);
  const rivalReport = await invoke(report, {
    method: "POST",
    path: "/api/forum/reports",
    cookie: rival.cookie,
    body: { type: "topic", id, reason: "spam" },
  });
  assert.equal(rivalReport.status, 404);
  const mateLike = await invoke(like, {
    method: "POST",
    path: "/api/forum/likes",
    cookie: mate.cookie,
    body: { type: "topic", id, liked: true },
  });
  assert.equal(mateLike.status, 200, mateLike.text);

  // Mentioning a rival in a team tribune does not leak the topic to them.
  const res = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${id}/posts`,
    params: { topicId: String(id) },
    cookie: mate.cookie,
    body: { content: `@${rival.username} @${fan.username} bakın buraya` },
  });
  assert.equal(res.status, 201, res.text);
  assert.equal((await inbox(rival.cookie)).length, 0);
  assert.ok((await inbox(fan.cookie)).some((x) => x.kind === "reply"));
});
