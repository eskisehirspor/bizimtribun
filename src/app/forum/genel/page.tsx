"use client";

import ForumBoardView from "@/components/forum/ForumBoardView";

export default function GeneralForumPage() {
  return (
    <ForumBoardView
      apiPath="/api/forum/genel/topics"
      newTopicPath="/forum/genel/yeni"
      backHref="/forum"
      backLabel="Tüm tribünler"
      active
      header={(total) => (
        <div className="mt-3">
          <h1 className="font-anton text-[32px] sm:text-[42px] leading-[0.85]">GENEL TRİBÜN</h1>
          <p className="font-mono text-[12px] mt-2 max-w-[56ch]">
            Takım ayırmadan futbol: lig gündemi, hakem, milli takım, Avrupa kupaları. Her takımdan
            doğrulanmış taraftar yazabilir.
          </p>
          <p className="font-mono text-[12px] opacity-70 mt-1">{total} konu</p>
        </div>
      )}
    />
  );
}
