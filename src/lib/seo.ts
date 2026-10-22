import type { Metadata } from "next";
import { appUrl } from "./request";

/**
 * Shared bits for search engines: site name, absolute URLs and schema.org
 * JSON-LD. Structured data only ever describes what the page itself shows.
 */
export const SITE_NAME = "Bizim Tribün";
export const SITE_TAGLINE = "En büyük kim?";
export const SITE_DESCRIPTION =
  "Türkiye tribünlerinin gerçek sayımı: doğrulanmış hesap başına tek ve kalıcı takım oyu. Takımların taraftar sayıları, il il dağılım ve Milli Takım Tribünü.";

export function siteOrigin() {
  return appUrl().replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Safe to drop into <script type="application/ld+json">: no "<" can close the tag. */
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

type JsonLd = Record<string, unknown>;

/** `sameAs` ties the site to its social profiles, so search and AI answers know they are one brand. */
export function organizationJsonLd(sameAs: string[] = []): JsonLd {
  const profiles = sameAs.filter((url) => url.startsWith("https://"));
  return {
    "@type": "Organization",
    "@id": `${siteOrigin()}/#organization`,
    name: SITE_NAME,
    url: `${siteOrigin()}/`,
    logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
    ...(profiles.length ? { sameAs: profiles } : {}),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": `${siteOrigin()}/#website`,
    name: SITE_NAME,
    alternateName: ["BizimTribun", "bizimtribun.com"],
    url: `${siteOrigin()}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "tr-TR",
    publisher: { "@id": `${siteOrigin()}/#organization` },
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLd {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export const HOME_CRUMB: Crumb = { name: "Ana sayfa", path: "/" };

type ForumAuthor = { username: string } | null | undefined;

function personOf(author: ForumAuthor, profilePublic: (username: string) => boolean): JsonLd {
  if (!author) return { "@type": "Person", name: "Silinmiş üye" };
  return {
    "@type": "Person",
    name: author.username,
    ...(profilePublic(author.username) ? { url: absoluteUrl(`/u/${author.username}`) } : {}),
  };
}

function likes(count: number | undefined): JsonLd[] {
  return [
    {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: count ?? 0,
    },
  ];
}

export type ForumTopicForSeo = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  likeCount: number;
  author: ForumAuthor;
};

export type ForumPostForSeo = {
  id: number;
  content: string;
  createdAt: string;
  likeCount?: number;
  author: ForumAuthor;
};

/**
 * Google's DiscussionForumPosting: the topic plus the comments shown on the
 * page. `totalComments` is the full count, `comments` only what is rendered.
 */
export function discussionForumPostingJsonLd(opts: {
  topic: ForumTopicForSeo;
  comments: ForumPostForSeo[];
  totalComments: number;
  boardName: string;
  boardPath: string;
  profilePublic?: (username: string) => boolean;
}): JsonLd {
  const { topic } = opts;
  const profilePublic = opts.profilePublic ?? (() => false);
  const url = absoluteUrl(`/forum/konu/${topic.id}`);
  return {
    "@type": "DiscussionForumPosting",
    "@id": url,
    mainEntityOfPage: url,
    url,
    headline: topic.title,
    text: topic.content,
    inLanguage: "tr-TR",
    datePublished: topic.createdAt,
    author: personOf(topic.author, profilePublic),
    interactionStatistic: [
      ...likes(topic.likeCount),
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: opts.totalComments,
      },
    ],
    isPartOf: { "@type": "WebPage", name: opts.boardName, url: absoluteUrl(opts.boardPath) },
    comment: opts.comments.map((post) => ({
      "@type": "Comment",
      url: `${url}#yorum-${post.id}`,
      text: post.content,
      datePublished: post.createdAt,
      author: personOf(post.author, profilePublic),
      interactionStatistic: likes(post.likeCount),
    })),
  };
}

export function graph(...nodes: JsonLd[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * The site-wide share card, a fixed file (public/og.png, drawn by
 * scripts/share-card.tsx) so it can never fail to render. A page that sets its
 * own openGraph replaces the parent's, image included, so it has to name one.
 */
export const DEFAULT_SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Bizim Tribün taraftar sayımı",
};

/** An indexable page: canonical URL plus matching share-card text. */
export function publicPageMetadata(opts: { title: string; description: string; path: string }): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [DEFAULT_SHARE_IMAGE.url],
    },
  };
}

/** Sign-in, account and form pages: never in search results. */
export function privatePageMetadata(title: string): Metadata {
  return { title: `${title} | ${SITE_NAME}`, robots: { index: false, follow: false } };
}
