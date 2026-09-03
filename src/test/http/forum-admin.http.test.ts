import "./env-init";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as register } from "../../app/api/auth/register/route";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as listTopics, POST as createTopic } from "../../app/api/forum/teams/[teamSlug]/topics/route";
import { GET as getTopic, PUT as putTopic, DELETE as deleteTopic } from "../../app/api/forum/topics/[topicId]/route";
import { POST as createPost } from "../../app/api/forum/topics/[topicId]/posts/route";
import { GET as heldList } from "../../app/api/admin/moderation/held/route";
import { POST as heldApprove } from "../../app/api/admin/moderation/[type]/[id]/approve/route";
import { POST as heldReject } from "../../app/api/admin/moderation/[type]/[id]/reject/route";
import { POST as heldBan } from "../../app/api/admin/moderation/[type]/[id]/ban/route";
import { POST as lockTopic } from "../../app/api/admin/forum/topics/[id]/lock/route";
import { POST as teamRequest } from "../../app/api/team-requests/route";
import { GET as adminTeamRequests } from "../../app/api/admin/team-requests/route";
import { POST as approveTeam } from "../../app/api/admin/team-requests/[id]/approve/route";
import { POST as rejectTeam } from "../../app/api/admin/team-requests/[id]/reject/route";
import { POST as adminBan } from "../../app/api/admin/users/[id]/ban/route";
import { getDb } from "@/lib/db";
import {
  FORUM_PAGE_MAX,
  FORUM_TOPICS_PER_USER_HOUR,
  TEAM_REQUESTS_PER_USER_HOUR,
} from "../../lib/policy";
import {
  TEST_PASSWORD,
  assertNoSensitiveLeak,
  authRegisterBody,
  freshDb,
  invoke,
  markEmailVerified,
  sessionCookie,
  trPhone,
  uniq,
} from "./harness";

const ALLOW = {
  title: "Derbi analizi temiz",
  content: "Rakip kaleci büyük hata yaptı, defans da çok açıktı.",
};
const REVIEW = {
  title: "Ofsayt tartışması",
  content: "Sen aptalsın, ofsaytı göremedin.",
};
const BLOCK = {
  title: "Hakem krizi",
  content: "Bu hakem orospu gibi yönetiyor.",
};

beforeEach(() => {
  freshDb();
});

let n = 0;
async function user(ip: string) {
  n += 1;
  const username = uniq("f").slice(0, 20);
  const res = await invoke(register, {
    method: "POST",
    path: "/api/auth/register",
    ip,
    body: authRegisterBody({
      username,
      email: `${username}@example.com`,
      phone: trPhone(2000 + n),
    }),
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const id = (res.json as { user: { id: number } }).user.id;
  markEmailVerified(id);
  return {
    username,
    cookie: sessionCookie(res.res),
    id,
  };
}

async function adminCookie(ip: string) {
  const u = await user(ip);
  getDb()
    .prepare(`UPDATE users SET role = 'admin' WHERE id = ?`)
    .run(u.id);
  const logged = await invoke(login, {
    method: "POST",
    path: "/api/auth/login",
    body: { login: u.username, password: TEST_PASSWORD },
    ip,
  });
  return sessionCookie(logged.res);
}

test("HTTP forum guest GET ok, POST 401", async () => {
  const list = await invoke(listTopics, {
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
  });
  assert.equal(list.status, 200);
  assertNoSensitiveLeak(list.json, ["city", "email", "phone"]);
  const pinned = (list.json as { topics: { isPinned: boolean }[] }).topics;
  const firstUnpinned = pinned.findIndex((t) => !t.isPinned);
  if (firstUnpinned > 0) {
    assert.ok(pinned.slice(0, firstUnpinned).every((t) => t.isPinned));
  }

  const postTopic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    body: ALLOW,
  });
  assert.equal(postTopic.status, 401);

  const seedId = (list.json as { topics: { id: number }[] }).topics[0]?.id;
  if (seedId) {
    const reply = await invoke(createPost, {
      method: "POST",
      path: `/api/forum/topics/${seedId}/posts`,
      params: { topicId: String(seedId) },
      body: { content: ALLOW.content },
    });
    assert.equal(reply.status, 401);
    const got = await invoke(getTopic, {
      path: `/api/forum/topics/${seedId}`,
      params: { topicId: String(seedId) },
    });
    assert.equal(got.status, 200);
    assertNoSensitiveLeak(got.json, ["city", "email", "phone"]);
  }
});

test("HTTP forum auth CRUD, 403, lock 409, pagination, category", async () => {
  const a = await user("203.0.113.140");
  const b = await user("203.0.113.141");
  const created = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
      body: { ...ALLOW, category: "tartisma" },
    ip: "203.0.113.140",
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const id = (created.json as { topic: { id: number; category: string } }).topic.id;
  assert.equal((created.json as { topic: { category: string } }).topic.category, "tartisma");

  const badCat = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: { ...ALLOW, category: "yok-boyle" },
    ip: "203.0.113.140",
  });
  assert.equal(badCat.status, 400);

  const page = await invoke(listTopics, {
    path: "/api/forum/teams/galatasaray/topics?page=1&limit=999",
    params: { teamSlug: "galatasaray" },
  });
  assert.equal((page.json as { limit: number }).limit, FORUM_PAGE_MAX);

  const invalidList = await invoke(listTopics, {
    path: "/api/forum/teams/galatasaray/topics?category=nope",
    params: { teamSlug: "galatasaray" },
  });
  assert.equal(invalidList.status, 400);

  const reply = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${id}/posts`,
    params: { topicId: String(id) },
    cookie: a.cookie,
    body: { content: ALLOW.content },
    ip: "203.0.113.140",
  });
  assert.equal(reply.status, 201, JSON.stringify(reply.json));

  const edited = await invoke(putTopic, {
    method: "PUT",
    path: `/api/forum/topics/${id}`,
    params: { topicId: String(id) },
    cookie: a.cookie,
    body: { title: "Güncel derbi notu", content: ALLOW.content },
  });
  assert.equal(edited.status, 200);

  const stolen = await invoke(putTopic, {
    method: "PUT",
    path: `/api/forum/topics/${id}`,
    params: { topicId: String(id) },
    cookie: b.cookie,
    body: { title: "Başkasının konusu", content: ALLOW.content },
  });
  assert.equal(stolen.status, 403);

  const admin = await adminCookie("203.0.113.142");
  const lock = await invoke(lockTopic, {
    method: "POST",
    path: `/api/admin/forum/topics/${id}/lock`,
    params: { id: String(id) },
    cookie: admin,
    body: { reason: "Maç bitti kilit" },
  });
  assert.equal(lock.status, 200, JSON.stringify(lock.json));
  const lockedPost = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${id}/posts`,
    params: { topicId: String(id) },
    cookie: a.cookie,
    body: { content: ALLOW.content },
  });
  assert.equal(lockedPost.status, 409);

  const otherDel = await invoke(deleteTopic, {
    method: "DELETE",
    path: `/api/forum/topics/${id}`,
    params: { topicId: String(id) },
    cookie: b.cookie,
  });
  assert.equal(otherDel.status, 403);
});

test("HTTP forum banned mutation 403", async () => {
  const a = await user("203.0.113.143");
  const admin = await adminCookie("203.0.113.144");
  const ban = await invoke(adminBan, {
    method: "POST",
    path: `/api/admin/users/${a.id}/ban`,
    params: { id: String(a.id) },
    cookie: admin,
    body: { reason: "Forum ihlali var" },
  });
  assert.equal(ban.status, 200);
  const topic = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: ALLOW,
  });
  assert.ok(topic.status === 401 || topic.status === 403);
});

test("HTTP forum topic rate limit", async () => {
  const a = await user("203.0.113.145");
  for (let i = 0; i < FORUM_TOPICS_PER_USER_HOUR; i++) {
    const r = await invoke(createTopic, {
      method: "POST",
      path: "/api/forum/teams/galatasaray/topics",
      params: { teamSlug: "galatasaray" },
      cookie: a.cookie,
      ip: "203.0.113.145",
      body: { title: `${ALLOW.title} ${i}`, content: ALLOW.content },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
  }
  const blocked = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    ip: "203.0.113.145",
    body: ALLOW,
  });
  assert.equal(blocked.status, 429);
});

test("HTTP moderation allow/review/block + held admin", async () => {
  const a = await user("203.0.113.146");
  const admin = await adminCookie("203.0.113.147");
  const allow = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: ALLOW,
    ip: "203.0.113.146",
  });
  assert.equal(allow.status, 201);
  const allowId = (allow.json as { topic: { id: number } }).topic.id;
  const publicAllow = await invoke(getTopic, {
    path: `/api/forum/topics/${allowId}`,
    params: { topicId: String(allowId) },
  });
  assert.equal(publicAllow.status, 200);

  const review = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: REVIEW,
    ip: "203.0.113.146",
  });
  assert.equal(review.status, 422);
  const heldRow = getDb()
    .prepare(
      `SELECT id FROM forum_topics WHERE held_at IS NOT NULL ORDER BY id DESC LIMIT 1`,
    )
    .get() as { id: number };
  const hidden = await invoke(getTopic, {
    path: `/api/forum/topics/${heldRow.id}`,
    params: { topicId: String(heldRow.id) },
  });
  assert.equal(hidden.status, 404);

  const block = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: BLOCK,
    ip: "203.0.113.146",
  });
  assert.equal(block.status, 422);
  const publicBlock = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM forum_topics WHERE content LIKE '%orospu%' AND held_at IS NULL AND deleted_at IS NULL`,
    )
    .get() as { c: number };
  assert.equal(publicBlock.c, 0);

  const list = await invoke(heldList, {
    path: "/api/admin/moderation/held",
    cookie: admin,
  });
  assert.equal(list.status, 200);
  const item = (list.json as { items: { kind: string; id: number }[] }).items.find(
    (i) => i.kind === "topic" && i.id === heldRow.id,
  );
  assert.ok(item);

  const idorType = await invoke(heldApprove, {
    method: "POST",
    path: `/api/admin/moderation/post/${heldRow.id}/approve`,
    params: { type: "post", id: String(heldRow.id) },
    cookie: admin,
    body: {},
  });
  assert.ok(idorType.status === 404 || idorType.status === 400);

  const idorMissing = await invoke(heldApprove, {
    method: "POST",
    path: "/api/admin/moderation/topic/999999/approve",
    params: { type: "topic", id: "999999" },
    cookie: admin,
    body: {},
  });
  assert.equal(idorMissing.status, 404);

  const approved = await invoke(heldApprove, {
    method: "POST",
    path: `/api/admin/moderation/topic/${heldRow.id}/approve`,
    params: { type: "topic", id: String(heldRow.id) },
    cookie: admin,
    body: { reason: "İncelendi yayınla" },
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.json));
  const nowPublic = await invoke(getTopic, {
    path: `/api/forum/topics/${heldRow.id}`,
    params: { topicId: String(heldRow.id) },
  });
  assert.equal(nowPublic.status, 200);
  const rejectAfter = await invoke(heldReject, {
    method: "POST",
    path: `/api/admin/moderation/topic/${heldRow.id}/reject`,
    params: { type: "topic", id: String(heldRow.id) },
    cookie: admin,
    body: { reason: "Sonradan red" },
  });
  assert.ok(rejectAfter.status === 409 || rejectAfter.status === 400);

  const review2 = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: { title: "İkinci tartışma", content: REVIEW.content },
    ip: "203.0.113.146",
  });
  assert.equal(review2.status, 422);
  const held2 = getDb()
    .prepare(
      `SELECT id FROM forum_topics WHERE held_at IS NOT NULL ORDER BY id DESC LIMIT 1`,
    )
    .get() as { id: number };
  const rejected = await invoke(heldReject, {
    method: "POST",
    path: `/api/admin/moderation/topic/${held2.id}/reject`,
    params: { type: "topic", id: String(held2.id) },
    cookie: admin,
    body: { reason: "Uygunsuz hakaret" },
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.json));
  const gone = await invoke(getTopic, {
    path: `/api/forum/topics/${held2.id}`,
    params: { topicId: String(held2.id) },
  });
  assert.equal(gone.status, 404);
  const approveAfter = await invoke(heldApprove, {
    method: "POST",
    path: `/api/admin/moderation/topic/${held2.id}/approve`,
    params: { type: "topic", id: String(held2.id) },
    cookie: admin,
    body: {},
  });
  assert.ok(approveAfter.status === 409 || approveAfter.status === 400);

  const review3 = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: { title: "Üçüncü tartışma", content: REVIEW.content },
    ip: "203.0.113.146",
  });
  assert.equal(review3.status, 422);
  const held3 = getDb()
    .prepare(
      `SELECT id FROM forum_topics WHERE held_at IS NOT NULL ORDER BY id DESC LIMIT 1`,
    )
    .get() as { id: number };
  const banned = await invoke(heldBan, {
    method: "POST",
    path: `/api/admin/moderation/topic/${held3.id}/ban`,
    params: { type: "topic", id: String(held3.id) },
    cookie: admin,
    body: { reason: "Tekrarlayan hakaret" },
  });
  assert.equal(banned.status, 200, JSON.stringify(banned.json));
  const stillHidden = await invoke(getTopic, {
    path: `/api/forum/topics/${held3.id}`,
    params: { topicId: String(held3.id) },
  });
  assert.equal(stillHidden.status, 404);
  const userRow = getDb()
    .prepare(`SELECT status FROM users WHERE id = ?`)
    .get(a.id) as { status: string };
  assert.equal(userRow.status, "banned");
});

test("HTTP held post public GET'te yok", async () => {
  const a = await user("203.0.113.148");
  const created = await invoke(createTopic, {
    method: "POST",
    path: "/api/forum/teams/galatasaray/topics",
    params: { teamSlug: "galatasaray" },
    cookie: a.cookie,
    body: ALLOW,
    ip: "203.0.113.148",
  });
  const topicId = (created.json as { topic: { id: number } }).topic.id;
  const heldPost = await invoke(createPost, {
    method: "POST",
    path: `/api/forum/topics/${topicId}/posts`,
    params: { topicId: String(topicId) },
    cookie: a.cookie,
    body: { content: REVIEW.content },
    ip: "203.0.113.148",
  });
  assert.equal(heldPost.status, 422);
  const got = await invoke(getTopic, {
    path: `/api/forum/topics/${topicId}`,
    params: { topicId: String(topicId) },
  });
  const posts = (got.json as { posts: { content: string }[] }).posts;
  assert.equal(posts.some((p) => p.content.includes("aptalsın")), false);
});

test("HTTP team request flow", async () => {
  const guest = await invoke(teamRequest, {
    method: "POST",
    path: "/api/team-requests",
    body: {
      teamName: "YeniSpor",
      city: "Eskişehir",
      message: "Tribün istiyoruz lütfen ekleyin.",
    },
  });
  assert.equal(guest.status, 401);

  const u = await user("203.0.113.150");
  const ok = await invoke(teamRequest, {
    method: "POST",
    path: "/api/team-requests",
    cookie: u.cookie,
    ip: "203.0.113.150",
    body: {
      teamName: "YeniSpor FK",
      city: "Eskişehir",
      message: "Tribün istiyoruz lütfen ekleyin.",
    },
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const reqId = (ok.json as { request: { id: number } }).request.id;

  const dup = await invoke(teamRequest, {
    method: "POST",
    path: "/api/team-requests",
    cookie: u.cookie,
    ip: "203.0.113.150",
    body: {
      teamName: "YeniSpor FK",
      city: "Eskişehir",
      message: "Tribün istiyoruz lütfen ekleyin.",
    },
  });
  assert.equal(dup.status, 409);

  const existing = await invoke(teamRequest, {
    method: "POST",
    path: "/api/team-requests",
    cookie: u.cookie,
    ip: "203.0.113.151",
    body: {
      teamName: "Galatasaray",
      city: "İstanbul",
      message: "Zaten var ama yine de deniyorum.",
    },
  });
  assert.equal(existing.status, 409);

  const userList = await invoke(adminTeamRequests, {
    path: "/api/admin/team-requests",
    cookie: u.cookie,
  });
  assert.equal(userList.status, 403);

  const admin = await adminCookie("203.0.113.152");
  const list = await invoke(adminTeamRequests, {
    path: "/api/admin/team-requests",
    cookie: admin,
  });
  assert.equal(list.status, 200);

  const approved = await invoke(approveTeam, {
    method: "POST",
    path: `/api/admin/team-requests/${reqId}/approve`,
    params: { id: String(reqId) },
    cookie: admin,
    body: { reason: "Kataloga alındı" },
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.json));
  const body = approved.json as { created: boolean; forumActive: boolean };
  assert.equal(body.forumActive, false);

  const again = await invoke(approveTeam, {
    method: "POST",
    path: `/api/admin/team-requests/${reqId}/approve`,
    params: { id: String(reqId) },
    cookie: admin,
    body: {},
  });
  assert.equal(again.status, 409);

  const u2 = await user("203.0.113.153");
  const pending = await invoke(teamRequest, {
    method: "POST",
    path: "/api/team-requests",
    cookie: u2.cookie,
    ip: "203.0.113.153",
    body: {
      teamName: "BaşkaSpor",
      city: "Bursa",
      message: "Tribün istiyoruz lütfen ekleyin.",
    },
  });
  const id2 = (pending.json as { request: { id: number } }).request.id;
  const rejected = await invoke(rejectTeam, {
    method: "POST",
    path: `/api/admin/team-requests/${id2}/reject`,
    params: { id: String(id2) },
    cookie: admin,
    body: { reason: "Yetersiz talep" },
  });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.json));

  for (let i = 0; i < TEAM_REQUESTS_PER_USER_HOUR; i++) {
    const r = await invoke(teamRequest, {
      method: "POST",
      path: "/api/team-requests",
      cookie: u2.cookie,
      ip: "203.0.113.154",
      body: {
        teamName: `LimitSpor ${i}`,
        city: "Ankara",
        message: "Tribün istiyoruz lütfen ekleyin.",
      },
    });
    if (i === 0) assert.ok(r.status === 201 || r.status === 409);
  }
});

test("HTTP robots/sitemap private yok", async () => {
  const { robotsPathDecision, sitemapHasPrivatePath } = await import(
    "../../lib/robots-policy"
  );
  assert.equal(robotsPathDecision("/admin"), "disallow");
  assert.equal(robotsPathDecision("/api/vote"), "disallow");
  assert.equal(robotsPathDecision("/giris?next=/admin"), "disallow");
  assert.equal(robotsPathDecision("/il/eskisehir"), "allow");
  assert.equal(robotsPathDecision("/takimlar"), "allow");
  assert.equal(robotsPathDecision("/takim/galatasaray/forum"), "allow");
  const sitemap = (await import("../../app/sitemap")).default;
  const urls = sitemap().map((e) => e.url);
  assert.equal(sitemapHasPrivatePath(urls), false);
  assert.equal(urls.filter((u) => u.includes("/il/")).length, 81);
  assert.ok(urls.some((u) => u.endsWith("/takimlar")));
  assert.ok(urls.some((u) => u.endsWith("/kvkk")));
  assert.ok(urls.some((u) => u.endsWith("/takim/galatasaray/forum")));
  assert.equal(urls.some((u) => u.includes("/admin")), false);
  assert.equal(urls.some((u) => u.includes("/uye-dogrula")), false);
  assert.equal(urls.some((u) => u.includes("/forum/yeni")), false);
  assert.equal(urls.length, new Set(urls).size);
});
