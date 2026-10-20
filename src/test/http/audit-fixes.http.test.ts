import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as createGeneral } from "../../app/api/forum/genel/topics/route";
import { PUT as putTopic } from "../../app/api/forum/topics/[topicId]/route";
import { POST as lockTopic } from "../../app/api/admin/forum/topics/[id]/lock/route";
import { DELETE as adminDeleteTopic } from "../../app/api/admin/forum/topics/[id]/route";
import { POST as like } from "../../app/api/forum/likes/route";
import { POST as block } from "../../app/api/account/blocks/route";
import { PATCH as patchProfile } from "../../app/api/account/profile/route";
import { getDb } from "@/lib/db";
import { safeNextPath } from "@/lib/forum-ui";
import { isReservedName } from "@/lib/name";
import { banUser } from "@/lib/users";
import { freshDb, invoke, smsSignup, trPhone, uniq } from "./harness";

beforeEach(() => {
  freshDb();
});

let n = 0;
async function member(role: "user" | "moderator" | "admin" = "user") {
  n += 1;
  const u = await smsSignup({ phone: trPhone(6100 + n), username: uniq("af").slice(0, 20), ip: `192.0.2.${100 + (n % 100)}` });
  if (role !== "user") getDb().prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, u.id);
  return u;
}

const TOPIC = { title: "Transfer dedikoduları", content: "Bu yaz kim gelir, kim gider?" };

async function topic(cookie: string) {
  const res = await invoke(createGeneral, { method: "POST", path: "/api/forum/genel/topics", cookie, body: TOPIC });
  assert.equal(res.status, 201, res.text);
  return (res.json as { topic: { id: number } }).topic.id;
}

test("login redirect stays on the site", () => {
  for (const bad of ["/\\evil.com", "//evil.com", "https://evil.com", "/\u0000x", "/\tx"]) {
    assert.equal(safeNextPath(bad), "/takimlar", JSON.stringify(bad));
  }
  assert.equal(safeNextPath("/forum/genel?x=1"), "/forum/genel?x=1");
});

test("a locked topic can't be rewritten by its author", async () => {
  const author = await member();
  const mod = await member("moderator");
  const id = await topic(author.cookie);
  const locked = await invoke(lockTopic, {
    method: "POST",
    path: `/api/admin/forum/topics/${id}/lock`,
    params: { id: String(id) },
    cookie: mod.cookie,
    body: { reason: "tartışma çığırından çıktı" },
  });
  assert.equal(locked.status, 200, locked.text);
  const edit = await invoke(putTopic, {
    method: "PUT",
    path: `/api/forum/topics/${id}`,
    params: { topicId: String(id) },
    cookie: author.cookie,
    body: { title: "Yeni başlık burada", content: "Tamamen başka bir şey." },
  });
  assert.equal(edit.status, 409);
});

test("moderators can't remove an admin's topic", async () => {
  const admin = await member("admin");
  const mod = await member("moderator");
  const id = await topic(admin.cookie);
  const res = await invoke(adminDeleteTopic, {
    method: "DELETE",
    path: `/api/admin/forum/topics/${id}`,
    params: { id: String(id) },
    cookie: mod.cookie,
    body: { reason: "deneme gerekçesi" },
  });
  assert.equal(res.status, 403);
});

test("a blocked member can't like the blocker's content", async () => {
  const a = await member();
  const b = await member();
  const id = await topic(a.cookie);
  const blocked = await invoke(block, { method: "POST", path: "/api/account/blocks", cookie: a.cookie, body: { userId: b.id, blocked: true } });
  assert.equal(blocked.status, 200, blocked.text);
  const res = await invoke(like, { method: "POST", path: "/api/forum/likes", cookie: b.cookie, body: { type: "topic", id, liked: true } });
  assert.equal(res.status, 403);
});

test("profile names can't pose as staff; deleted accounts can't be banned", async () => {
  assert.equal(isReservedName("Bizim Tribün Yönetimi"), true);
  assert.equal(isReservedName("Kartal 1903"), false);
  const u = await member();
  const res = await invoke(patchProfile, {
    method: "PATCH",
    path: "/api/account/profile",
    cookie: u.cookie,
    body: { displayName: "Moderatör Ekibi" },
  });
  assert.equal(res.status, 400);
  getDb().prepare(`UPDATE users SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), u.id);
  assert.equal(banUser(u.id, "test").ok, false);
});
