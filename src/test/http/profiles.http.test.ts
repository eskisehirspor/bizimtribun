import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GET as getProfile, PATCH as patchProfile } from "../../app/api/account/profile/route";
import { GET as activity } from "../../app/api/users/[username]/activity/route";
import { POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { POST as createPost } from "../../app/api/forum/topics/[topicId]/posts/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { GET as notifications } from "../../app/api/notifications/route";
import { getDb } from "@/lib/db";
import { getPublicProfile, listBadges } from "@/lib/profiles";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(async () => {
  await freshDb();
});

let n = 0;
async function member() {
  n += 1;
  return smsSignup({ phone: trPhone(8500 + n), username: uniq("p").slice(0, 20), ip: `198.51.100.${n % 250}` });
}

async function topic(cookie: string) {
  const res = await invoke(createGeneral, {
    method: "POST",
    path: "/api/forum/genel/topics",
    cookie,
    // The same text can't be sent twice, so each topic gets its own.
    body: { title: "Derbi öncesi kadro", content: `İlk on biri yazın bakalım. (${++n})` },
  });
  assert.equal(res.status, 201, res.text);
  return (res.json as { topic: { id: number } }).topic.id;
}

test("public profile hides private fields and members-only profiles from visitors", async () => {
  const a = await member();
  const asGuest = await getPublicProfile(getDb(), a.username, { signedIn: false });
  assert.equal(asGuest.ok, false);
  assert.equal(!asGuest.ok && asGuest.status, 403);

  const asMember = await getPublicProfile(getDb(), a.username, { signedIn: true });
  assert.ok(asMember.ok);
  const json = JSON.stringify(asMember.profile);
  for (const key of ["phone", "email", "first_name", "birth", "verified", "İstanbul"]) {
    assert.equal(json.includes(key), false, `profile leaks ${key}`);
  }
  assert.equal(asMember.profile.teamId, "galatasaray");

  const res = await invoke(patchProfile, {
    method: "PATCH",
    path: "/api/account/profile",
    cookie: a.cookie,
    body: { visibility: "public", showCity: true, bio: "Tribünün sesi", avatar: "davul" },
  });
  assert.equal(res.status, 200, res.text);
  const pub = await getPublicProfile(getDb(), a.username, { signedIn: false });
  assert.ok(pub.ok);
  assert.deepEqual([pub.profile.province, pub.profile.bio, pub.profile.avatar], ["İstanbul", "Tribünün sesi", "davul"]);
});

test("profile settings cannot change role, team, username or status", async () => {
  const a = await member();
  for (const body of [{ role: "super_admin" }, { teamId: "fenerbahce" }, { username: "baskasi" }, { status: "active" }]) {
    const res = await invoke(patchProfile, { method: "PATCH", path: "/api/account/profile", cookie: a.cookie, body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const row = await getDb().prepare(`SELECT role, team_id, username FROM users WHERE id = ?`).get(a.id) as {
    role: string;
    team_id: string;
    username: string;
  };
  assert.deepEqual([row.role, row.team_id, row.username], ["user", "galatasaray", a.username]);
  const guest = await invoke(getProfile, { path: "/api/account/profile" });
  assert.equal(guest.status, 401);
  const bad = await invoke(patchProfile, {
    method: "PATCH",
    path: "/api/account/profile",
    cookie: a.cookie,
    body: { avatar: "<script>" },
  });
  assert.equal(bad.status, 400);
});

test("badges come from forum activity, never from votes, and notify once", async () => {
  const a = await member();
  assert.deepEqual(await listBadges(getDb(), a.id), []);
  const id = await topic(a.cookie);
  const reply = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${id}/posts`,
    cookie: a.cookie,
    params: { topicId: String(id) },
    body: { content: "Ben de yazayım." },
  });
  assert.equal(reply.status, 201, reply.text);
  assert.deepEqual(
    (await listBadges(getDb(), a.id)).map((b) => b.key),
    ["ilk_konu", "ilk_yorum"],
  );
  await topic(a.cookie);
  const inbox = await invoke(notifications, { path: "/api/notifications", cookie: a.cookie });
  const kinds = (inbox.json as { items: { kind: string }[] }).items.map((i) => i.kind);
  assert.equal(kinds.filter((k) => k === "badge").length, 2);

  // Writing XP is capped per day: lots of posts on one day stay at the cap.
  const profile = await getPublicProfile(getDb(), a.username, { signedIn: true });
  assert.ok(profile.ok);
  assert.ok(profile.profile.xp <= 10, `xp ${profile.profile.xp}`);
});

test("likes add XP and like notifications respect the member's preference", async () => {
  const a = await member();
  const b = await member();
  const id = await topic(a.cookie);
  await invoke(patchProfile, { method: "PATCH", path: "/api/account/profile", cookie: a.cookie, body: { notifyLikes: false } });
  const before = await getPublicProfile(getDb(), a.username, { signedIn: true });
  const res = await invoke(like, {
    method: "POST",
    path: "/api/forum/likes",
    cookie: b.cookie,
    body: { type: "topic", id, liked: true },
  });
  assert.equal(res.status, 200, res.text);
  const after = await getPublicProfile(getDb(), a.username, { signedIn: true });
  assert.ok(before.ok && after.ok);
  assert.equal(after.profile.xp - before.profile.xp, 2);
  assert.equal(after.profile.counts.likesReceived, 1);
  const likes = await getDb()
      .prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND kind = 'like'`)
      .get(a.id) as { c: number };
  assert.equal(likes.c, 0);
});

test("activity lists live content only and deleted accounts have no profile", async () => {
  const a = await member();
  const id = await topic(a.cookie);
  const removed = await topic(a.cookie);
  await getDb().prepare(`UPDATE forum_topics SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), removed);
  const res = await invoke(activity, {
    path: `/api/users/${a.username}/activity`,
    params: { username: a.username },
    cookie: a.cookie,
  });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual(
    (res.json as { items: { id: number }[] }).items.map((i) => i.id),
    [id],
  );
  const guest = await invoke(activity, { path: `/api/users/${a.username}/activity`, params: { username: a.username } });
  assert.equal(guest.status, 403);

  await getDb().prepare(`UPDATE users SET deleted_at = ?, status = 'deleted' WHERE id = ?`).run(new Date().toISOString(), a.id);
  const gone = await getPublicProfile(getDb(), a.username, { signedIn: true });
  assert.equal(!gone.ok && gone.status, 404);
});
