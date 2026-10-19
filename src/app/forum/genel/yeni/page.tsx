"use client";

import ForumNewTopicView from "@/components/forum/ForumNewTopicView";

export default function GeneralNewTopicPage() {
  return (
    <ForumNewTopicView
      apiPath="/api/forum/genel/topics"
      boardPath="/forum/genel"
      boardTitle="Genel Tribün"
      active
    />
  );
}
