"use client";

import { useState } from "react";
import { BlockButton, ReportButton } from "@/components/forum/ForumActions";

export default function ProfileActions({ userId, username }: { userId: number; username: string }) {
  const [blocked, setBlocked] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
      <ReportButton type="user" id={userId} />
      {blocked ? (
        <span>@{username} engellendi. Yazıları sana gösterilmeyecek.</span>
      ) : (
        <BlockButton userId={userId} username={username} onBlocked={() => setBlocked(true)} />
      )}
    </div>
  );
}
