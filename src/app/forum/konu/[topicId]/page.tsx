import type { Metadata } from "next";
import ForumTopicView from "@/components/forum/ForumTopicView";
import { getSessionUser } from "@/lib/auth";
import { findLiveTopic, parseIdParam, topicAccess, topicBoardOpen } from "@/lib/forum";
import { appUrl } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const id = parseIdParam(topicId);
  const topic = id == null ? undefined : findLiveTopic(id);
  if (!topic || !topicBoardOpen(topic)) {
    return { title: "Konu bulunamadı | Bizim Tribün", robots: { index: false, follow: false } };
  }
  // Team tribunes are members-only: no title or excerpt for anyone who can't read it,
  // and never indexed.
  if (topic.board === "team") {
    if (!topicAccess(topic, await getSessionUser()).ok) {
      return { title: "Takım tribünü | Bizim Tribün", robots: { index: false, follow: false } };
    }
    return { title: `${topic.title} | Bizim Tribün`, robots: { index: false, follow: false } };
  }
  const title = `${topic.title} | Bizim Tribün`;
  const description = topic.content.replace(/\s+/g, " ").trim().slice(0, 155);
  const url = `${appUrl().replace(/\/$/, "")}/forum/konu/${topic.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, locale: "tr_TR", type: "article", siteName: "Bizim Tribün" },
    twitter: { card: "summary", title, description },
  };
}

export default function TopicPage() {
  return <ForumTopicView />;
}
