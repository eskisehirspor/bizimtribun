import type { Metadata } from "next";
import ForumTopicView, { type TopicInitial } from "@/components/forum/ForumTopicView";
import JsonLd from "@/components/JsonLd";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { findLiveTopic, listPosts, parseIdParam, serializeTopic, topicAccess, topicBoardOpen } from "@/lib/forum";
import { NATIONAL_BOARD_NAME, NATIONAL_BOARD_PATH } from "@/lib/national-board";
import { FORUM_PAGE_DEFAULT } from "@/lib/policy";
import { publicUsernames } from "@/lib/profiles";
import {
  DEFAULT_SHARE_IMAGE,
  HOME_CRUMB,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  discussionForumPostingJsonLd,
  graph,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

function excerpt(text: string, max = 155) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

async function publicTopic(topicId: string) {
  const id = parseIdParam(topicId);
  const topic = id == null ? undefined : findLiveTopic(id);
  if (!topic || !topicBoardOpen(topic)) return { topic: undefined, open: false };
  return { topic, open: topic.board === "general" };
}

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const { topic, open } = await publicTopic(topicId);
  if (!topic) {
    return { title: `Konu bulunamadı | ${SITE_NAME}`, robots: { index: false, follow: false } };
  }
  // Team tribunes are members-only: no title or excerpt for anyone who can't read it,
  // and never indexed.
  if (!open) {
    if (!topicAccess(topic, await getSessionUser()).ok) {
      return { title: `Takım tribünü | ${SITE_NAME}`, robots: { index: false, follow: false } };
    }
    return { title: `${topic.title} | ${SITE_NAME}`, robots: { index: false, follow: false } };
  }
  const title = `${topic.title} | ${SITE_NAME}`;
  const description = excerpt(topic.content);
  const url = absoluteUrl(`/forum/konu/${topic.id}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      locale: "tr_TR",
      type: "article",
      siteName: SITE_NAME,
      publishedTime: topic.created_at,
      modifiedTime: topic.updated_at,
      section: NATIONAL_BOARD_NAME,
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SHARE_IMAGE.url] },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const { topic, open } = await publicTopic(topicId);
  // Only the open Milli Takım Tribünü is rendered on the server; team tribunes
  // load in the browser after the membership check, as before.
  if (!topic || !open) return <ForumTopicView />;

  const first = listPosts(topic.id, 0, FORUM_PAGE_DEFAULT, null);
  const initial = { topic: serializeTopic(topic, null), posts: first.posts, total: first.total } as TopicInitial;
  const names = [initial.topic.author?.username, ...initial.posts.map((p) => p.author?.username)].filter(
    (n): n is string => Boolean(n),
  );
  const publicNames = publicUsernames(getDb(), names);
  const jsonLd = graph(
    discussionForumPostingJsonLd({
      topic: initial.topic,
      comments: initial.posts,
      totalComments: initial.total,
      boardName: NATIONAL_BOARD_NAME,
      boardPath: NATIONAL_BOARD_PATH,
      profilePublic: (u) => publicNames.has(u),
    }),
    breadcrumbJsonLd([
      HOME_CRUMB,
      { name: "Tribün", path: "/forum" },
      { name: NATIONAL_BOARD_NAME, path: NATIONAL_BOARD_PATH },
      { name: topic.title, path: `/forum/konu/${topic.id}` },
    ]),
  );
  return (
    <>
      <JsonLd data={jsonLd} />
      <ForumTopicView initial={initial} />
    </>
  );
}
