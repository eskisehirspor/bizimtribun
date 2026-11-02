import { wordCount } from "./blog-markdown";
import { BLOG_POSTS } from "@/content/blog";

/**
 * Blog posts live in src/content/blog as code, so they ship inside the Worker
 * bundle (no file system at runtime). A post is a draft until an editor sets
 * `status: "published"`; drafts are visible in development only and never
 * reach production pages, the sitemap or llms.txt.
 */

export type BlogSource = {
  /** What is cited, as the publisher titles it. */
  title: string;
  publisher: string;
  /** When the source was published or the fieldwork done, as the source says it. */
  date: string;
  url: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  /** Search snippet and share text, at most 160 characters. */
  description: string;
  /** YYYY-MM-DD. */
  publishedAt: string;
  updatedAt?: string;
  status: "draft" | "published";
  /** Markdown subset, see blog-markdown.ts. */
  body: string;
  /** Every number in a post that does not come from Bizim Tribün itself needs one. */
  sources: BlogSource[];
};

export const BLOG_PATH = "/blog";
export const BLOG_TITLE = "Tribün Notları";

export function blogPostPath(slug: string) {
  return `${BLOG_PATH}/${slug}`;
}

export function draftsVisible(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== "production";
}

/** Newest first, same-day posts in registry order; drafts only where they may be seen. */
export function listPosts(posts: BlogPost[] = BLOG_POSTS, withDrafts = draftsVisible()) {
  return posts
    .filter((p) => withDrafts || p.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getPost(slug: string, posts: BlogPost[] = BLOG_POSTS, withDrafts = draftsVisible()) {
  return listPosts(posts, withDrafts).find((p) => p.slug === slug);
}

/** Minutes, rounded up, at a relaxed 200 words a minute. */
export function readingMinutes(post: Pick<BlogPost, "body">) {
  return Math.max(1, Math.ceil(wordCount(post.body) / 200));
}

/** "2 Kasım 2026" from YYYY-MM-DD, the same on server and browser. */
export function formatPostDate(day: string) {
  const months = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

/** Problems that would make a post unfit to publish; empty when it is fine. */
export function postProblems(post: BlogPost): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(post.slug)) problems.push("slug: küçük harf, rakam ve tire");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt)) problems.push("publishedAt: YYYY-AA-GG");
  if (post.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(post.updatedAt)) problems.push("updatedAt: YYYY-AA-GG");
  if (post.title.length > 70) problems.push("title: en fazla 70 karakter");
  if (post.description.length < 50 || post.description.length > 160) problems.push("description: 50-160 karakter");
  for (const s of post.sources) {
    if (!s.url.startsWith("https://")) problems.push(`kaynak https değil: ${s.url}`);
  }
  return problems;
}
