import assert from "node:assert/strict";
import { test } from "node:test";
import { breadcrumbJsonLd, discussionForumPostingJsonLd, jsonLdString, privatePageMetadata } from "./seo";

process.env.APP_URL = "https://bizimtribun.example/";

test("JSON-LD cannot close its script tag", () => {
  const out = jsonLdString({ text: "</script><script>alert(1)</script>" });
  assert.equal(out.includes("<"), false);
  assert.deepEqual(JSON.parse(out), { text: "</script><script>alert(1)</script>" });
});

test("breadcrumbs are absolute and numbered from 1", () => {
  const crumbs = breadcrumbJsonLd([
    { name: "Ana sayfa", path: "/" },
    { name: "Takımlar", path: "/takimlar" },
  ]) as { itemListElement: { position: number; item: string }[] };
  assert.deepEqual(
    crumbs.itemListElement.map((c) => [c.position, c.item]),
    [
      [1, "https://bizimtribun.example/"],
      [2, "https://bizimtribun.example/takimlar"],
    ],
  );
});

test("forum posting links only public profiles and counts every comment", () => {
  const data = discussionForumPostingJsonLd({
    topic: { id: 7, title: "Milli maç", content: "Kadro?", createdAt: "2026-10-01T10:00:00.000Z", likeCount: 3, author: { username: "acik" } },
    comments: [
      { id: 11, content: "Bence iyi", createdAt: "2026-10-01T11:00:00.000Z", likeCount: 1, author: { username: "gizli" } },
    ],
    totalComments: 25,
    boardName: "Milli Takım Tribünü",
    boardPath: "/forum/milli-takim",
    profilePublic: (u) => u === "acik",
  }) as Record<string, unknown> & {
    author: { url?: string };
    comment: { url: string; author: { url?: string } }[];
    interactionStatistic: { userInteractionCount: number }[];
  };
  assert.equal(data["@type"], "DiscussionForumPosting");
  assert.equal(data.url, "https://bizimtribun.example/forum/konu/7");
  assert.equal(data.author.url, "https://bizimtribun.example/u/acik");
  assert.equal(data.comment[0].author.url, undefined);
  assert.equal(data.comment[0].url, "https://bizimtribun.example/forum/konu/7#yorum-11");
  assert.deepEqual(
    data.interactionStatistic.map((s) => s.userInteractionCount),
    [3, 25],
  );
});

test("private pages are noindex", () => {
  assert.deepEqual(privatePageMetadata("Giriş yap").robots, { index: false, follow: false });
});
