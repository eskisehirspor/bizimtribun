"use client";

import ForumNewTopicView from "@/components/forum/ForumNewTopicView";
import { NATIONAL_BOARD_NAME, NATIONAL_BOARD_PATH } from "@/lib/national-board";

export default function NationalNewTopicPage() {
  return (
    <ForumNewTopicView
      apiPath="/api/forum/genel/topics"
      boardPath={NATIONAL_BOARD_PATH}
      boardTitle={NATIONAL_BOARD_NAME}
      active
    />
  );
}
