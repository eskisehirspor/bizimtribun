import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { GET as listGeneral, POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import * as topicRoute from "../../app/api/forum/topics/[topicId]/route";
import * as postRoute from "../../app/api/forum/posts/[postId]/route";
const getTopic = topicRoute.GET;
import { POST as createPost } from "../../app/api/forum/topics/[topicId]/posts/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { POST as report } from "../../app/api/forum/reports/route";
import { GET as blocks, POST as block } from "../../app/api/account/blocks/route";
import { GET as notifications } from "../../app/api/notifications/route";
import { POST as readNotifications } from "../../app/api/notifications/read/route";
import { GET as adminReports } from "../../app/api/admin/reports/route";
import { POST as closeReport } from "../../app/api/admin/reports/[id]/route";
import { getDb } from "@/lib/db";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(async () => {
  await freshDb();
});

let n = 0;
async function member(role: "user" | "moderator" = "user") {
  n += 1;
  const u = await smsSignup({
    phone: trPhone(8000 + n),
    username: uniq("s").slice(0, 20),
    ip: `192.0.2.${n % 250}`,
  });
  if (role !== "user") await getDb().prepare(`UPDATE users SET role = ?, totp_enabled = 1 WHERE id = ?`).run(role, u.id);
  return u;
}

const TOPIC = { title: "Milli takım kadrosu", content: "Hangi isimler olmalı, yazın bakalım." };

async function generalTopic(cookie: string) {
  const res = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie, body: TOPIC });
  assert.equal(res.status, 201, res.text);
  return (res.json as { topic: { id: number } }).topic.id;
}

async function reply(cookie: string, topicId: number, content: string) {
  return invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${topicId}/posts`,
    cookie,
    params: { topicId: String(topicId) },
    body: { content },
  });
}

test("Milli Takım Tribünü lists and creates topics", async () => {
  const a = await member();
  const id = await generalTopic(a.cookie);
  const list = await invoke(listGeneral, { path: "/api/forum/genel/topics" });
  assert.equal(list.status, 200);
  const topics = (list.json as { topics: { id: number; board: string; teamId: string | null }[] }).topics;
  assert.deepEqual(topics.map((t) => [t.id, t.board, t.teamId]), [[id, "general", null]]);

  const guest = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", body: TOPIC });
  assert.equal(guest.status, 401);
});

test("likes: not your own, counted once, one notification per liker", async () => {
  const author = await member();
  const fan = await member();
  const id = await generalTopic(author.cookie);
  const likeAs = (cookie: string, liked: boolean) =>
    invoke(like, { method: "POST", path: "/api/forum/likes", cookie, body: { type: "topic", id, liked } });

  assert.equal((await likeAs(author.cookie, true)).status, 400);
  const first = await likeAs(fan.cookie, true);
  assert.deepEqual(first.json, { ok: true, likeCount: 1, likedByMe: true });
  await likeAs(fan.cookie, true);
  await likeAs(fan.cookie, false);
  await likeAs(fan.cookie, true);
  const topic = await invoke(getTopic, { path: `/api/forum/topics/${id}`, params: { topicId: String(id) } });
  assert.equal((topic.json as { topic: { likeCount: number } }).topic.likeCount, 1);

  const inbox = await invoke(notifications, { path: "/api/notifications", cookie: author.cookie });
  const items = (inbox.json as { unread: number; items: { kind: string }[] }).items;
  assert.deepEqual(items.map((i) => i.kind).filter((k) => k !== "badge"), ["like"]);
});

test("replies and @mentions notify; read marks clear the badge", async () => {
  const author = await member();
  const fan = await member();
  const third = await member();
  const id = await generalTopic(author.cookie);
  const res = await reply(fan.cookie, id, `Katılıyorum @${third.username} ne dersin?`);
  assert.equal(res.status, 201, res.text);

  const a = await invoke(notifications, { path: "/api/notifications", cookie: author.cookie });
  // The reply, plus the author's own "first topic" badge.
  const inboxA = a.json as { unread: number; items: { kind: string }[] };
  assert.deepEqual(inboxA.items.map((i) => i.kind).sort(), ["badge", "reply"]);
  assert.equal(inboxA.unread, 2);
  const t = await invoke(notifications, { path: "/api/notifications", cookie: third.cookie });
  assert.deepEqual((t.json as { items: { kind: string }[] }).items.map((i) => i.kind), ["mention"]);

  const read = await invoke(readNotifications, {
    method: "POST",
    path: "/api/notifications/read",
    cookie: author.cookie,
    body: { ids: "all" },
  });
  assert.equal((read.json as { unread: number }).unread, 0);
});

test("blocks hide content, stop replies to the blocker and stop notifications", async () => {
  const me = await member();
  const troll = await member();
  const id = await generalTopic(me.cookie);
  assert.equal((await reply(troll.cookie, id, "ilk yorum")).status, 201);

  const b = await invoke(block, {
    method: "POST",
    path: "/api/account/blocks",
    cookie: me.cookie,
    body: { userId: troll.id, blocked: true },
  });
  assert.equal(b.status, 200, b.text);

  const view = await invoke(getTopic, { path: `/api/forum/topics/${id}`, cookie: me.cookie, params: { topicId: String(id) } });
  assert.equal((view.json as { total: number }).total, 0);
  const guestView = await invoke(getTopic, { path: `/api/forum/topics/${id}`, params: { topicId: String(id) } });
  assert.equal((guestView.json as { total: number }).total, 1);

  assert.equal((await reply(troll.cookie, id, "yine ben")).status, 403);
  const trollTopic = await generalTopic(troll.cookie);
  const list = await invoke(listGeneral, { path: "/api/forum/genel/topics", cookie: me.cookie });
  assert.ok(!(list.json as { topics: { id: number }[] }).topics.some((t) => t.id === trollTopic));

  const listed = await invoke(blocks, { path: "/api/account/blocks", cookie: me.cookie });
  assert.equal((listed.json as { blocks: unknown[] }).blocks.length, 1);
  const self = await invoke(block, {
    method: "POST",
    path: "/api/account/blocks",
    cookie: me.cookie,
    body: { userId: me.id, blocked: true },
  });
  assert.equal(self.status, 400);
});

test("reports: one per member per item, moderators close all at once, audited", async () => {
  const author = await member();
  const r1 = await member();
  const r2 = await member();
  const mod = await member("moderator");
  const id = await generalTopic(author.cookie);
  const file = (cookie: string) =>
    invoke(report, { method: "POST", path: "/api/forum/reports", cookie, body: { type: "topic", id, reason: "spam" } });
  assert.equal((await file(r1.cookie)).status, 201);
  assert.equal((await file(r1.cookie)).status, 409);
  assert.equal((await file(r2.cookie)).status, 201);
  assert.equal((await file(author.cookie)).status, 400);

  const forbidden = await invoke(adminReports, { path: "/api/admin/reports", cookie: r1.cookie });
  assert.equal(forbidden.status, 403);
  const queue = await invoke(adminReports, { path: "/api/admin/reports", cookie: mod.cookie });
  const items = (queue.json as { items: { id: number; sameTargetOpen: number }[] }).items;
  assert.equal(items.length, 2);
  assert.equal(items[0]!.sameTargetOpen, 2);

  const closed = await invoke(closeReport, {
    method: "POST",
    path: `/api/admin/reports/${items[0]!.id}`,
    cookie: mod.cookie,
    params: { id: String(items[0]!.id) },
    body: { outcome: "dismissed", reason: "kural ihlali yok" },
  });
  assert.deepEqual(closed.json, { ok: true, closed: 2 });
  const audit = await getDb().prepare(`SELECT action FROM audit_log WHERE action = 'report_dismiss'`).all();
  assert.equal(audit.length, 1);
});

test("topics and replies can't be edited after publishing, only deleted", () => {
  assert.equal("PUT" in topicRoute, false);
  assert.equal("PATCH" in topicRoute, false);
  assert.equal("PUT" in postRoute, false);
  assert.equal("PATCH" in postRoute, false);
  assert.equal(typeof topicRoute.DELETE, "function");
  assert.equal(typeof postRoute.DELETE, "function");
});

test("three members reporting a reply hide it until a moderator looks; staff replies stay", async () => {
  const author = await member();
  const id = await generalTopic(author.cookie);
  const res = await reply(author.cookie, id, "Hakem bugün çok kötüydü.");
  assert.equal(res.status, 201, res.text);
  const postId = (res.json as { post: { id: number } }).post.id;
  const fileOn = (cookie: string, target: number) =>
    invoke(report, { method: "POST", path: "/api/forum/reports", cookie, body: { type: "post", id: target, reason: "hakaret" } });
  const held = async () =>
    (await getDb().prepare(`SELECT held_at FROM forum_posts WHERE id = ?`).get(postId) as { held_at: string | null }).held_at;

  for (let i = 0; i < 2; i++) assert.equal((await fileOn((await member()).cookie, postId)).status, 201);
  assert.equal(await held(), null);
  assert.equal((await fileOn((await member()).cookie, postId)).status, 201);
  assert.ok(await held());
  const action = await getDb()
      .prepare(`SELECT action, reason FROM moderation_actions WHERE target_post_id = ?`)
      .get(postId) as { action: string; reason: string };
  assert.equal(action.action, "auto_review");
  assert.match(action.reason, /^auto:review:reports:/);

  const mod = await member("moderator");
  const modReply = await reply(mod.cookie, id, "Lütfen kurallara uyalım.");
  const modPostId = (modReply.json as { post: { id: number } }).post.id;
  for (let i = 0; i < 3; i++) await fileOn((await member()).cookie, modPostId);
  const modHeld = await getDb().prepare(`SELECT held_at FROM forum_posts WHERE id = ?`).get(modPostId) as { held_at: string | null };
  assert.equal(modHeld.held_at, null);
});

test("the same reply can't be sent twice", async () => {
  const a = await member();
  const id = await generalTopic(a.cookie);
  assert.equal((await reply(a.cookie, id, "Kadroda sol bek eksik.")).status, 201);
  const again = await reply(a.cookie, id, "  kadroda SOL bek   eksik. ");
  assert.equal(again.status, 409);
  assert.match(again.text, /zaten gönderdin/);
});
