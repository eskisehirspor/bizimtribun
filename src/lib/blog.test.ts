import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOG_POSTS } from "@/content/blog";
import { type BlogPost, draftsVisible, formatPostDate, getPost, listPosts, postProblems, readingMinutes } from "./blog";
import { parseMarkdown, inlineText } from "./blog-markdown";
import { getCityBySlug } from "./cities";
import { getTeam } from "./teams";

const base: BlogPost = {
  slug: "ornek",
  title: "Örnek",
  description: "Elli karakterden uzun, yüz altmıştan kısa bir örnek açıklama metni burada.",
  publishedAt: "2026-11-01",
  status: "published",
  body: "Merhaba",
  sources: [],
};

test("drafts are hidden in production and shown in development", () => {
  const posts = [base, { ...base, slug: "taslak", status: "draft" as const, publishedAt: "2026-11-05" }];
  assert.equal(draftsVisible({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(draftsVisible({ NODE_ENV: "development" } as NodeJS.ProcessEnv), true);
  assert.deepEqual(listPosts(posts, false).map((p) => p.slug), ["ornek"]);
  assert.deepEqual(listPosts(posts, true).map((p) => p.slug), ["taslak", "ornek"]);
  assert.equal(getPost("taslak", posts, false), undefined);
  assert.equal(getPost("taslak", posts, true)?.slug, "taslak");
});

test("dates and reading time", () => {
  assert.equal(formatPostDate("2026-11-02"), "2 Kasım 2026");
  assert.equal(readingMinutes({ body: "kelime ".repeat(450) }), 3);
});

test("every post in the repo is fit to publish", () => {
  const slugs = new Set<string>();
  for (const post of BLOG_POSTS) {
    assert.deepEqual(postProblems(post), [], post.slug);
    assert.ok(!slugs.has(post.slug), `tekrar eden slug: ${post.slug}`);
    slugs.add(post.slug);
    // Every link in a post is one the renderer will keep.
    for (const m of post.body.matchAll(/\]\(([^)]+)\)/g)) {
      assert.ok(m[1].startsWith("/") || m[1].startsWith("https://") || m[1].startsWith("#"), `${post.slug}: ${m[1]}`);
    }
    // Links to provinces, teams and other posts lead somewhere real.
    for (const m of post.body.matchAll(/\]\(\/(il|takim|blog)\/([^)#]+)\)/g)) {
      const [, kind, slug] = m;
      const ok =
        kind === "il" ? Boolean(getCityBySlug(slug)) : kind === "takim" ? Boolean(getTeam(slug)) : BLOG_POSTS.some((p) => p.slug === slug);
      assert.ok(ok, `${post.slug}: /${kind}/${slug} bulunamadı`);
    }
    assert.ok(parseMarkdown(post.body).length > 0);
    assert.ok(inlineText([{ type: "text", text: post.title }]).length > 0);
  }
});

test("postProblems catches bad metadata", () => {
  const bad = postProblems({ ...base, slug: "Kötü Slug", description: "kısa", sources: [{ title: "x", publisher: "y", date: "2020", url: "http://x" }] });
  assert.equal(bad.length, 3);
});
