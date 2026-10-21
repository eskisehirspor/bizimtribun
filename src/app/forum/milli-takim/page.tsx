"use client";

import { MilliPanel } from "@/components/AyYildiz";
import ForumBoardView from "@/components/forum/ForumBoardView";
import { NATIONAL_BOARD_PATH, NATIONAL_BOARD_TITLE } from "@/lib/national-board";

export default function NationalForumPage() {
  return (
    <ForumBoardView
      apiPath="/api/forum/genel/topics"
      newTopicPath={`${NATIONAL_BOARD_PATH}/yeni`}
      backHref="/forum"
      backLabel="Tüm tribünler"
      active
      header={(total) => (
        <MilliPanel className="mt-3 p-4 pb-6">
          <h1 className="font-anton text-[32px] sm:text-[42px] leading-[0.85]">{NATIONAL_BOARD_TITLE}</h1>
          <p className="font-mono text-[12px] mt-3 max-w-[52ch]">
            Ay yıldızlılar, milli maçlar, kadro ve takım ayırmadan futbol gündemi. Her takımdan
            doğrulanmış taraftar yazabilir.
          </p>
          <p className="font-mono text-[12px] opacity-80 mt-1">{total} konu</p>
        </MilliPanel>
      )}
    />
  );
}
