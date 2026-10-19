"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SiteState = {
  announcement: { text: string; tone: "info" | "warning"; link: string } | null;
  maintenance: { message: string } | null;
};

/** Admin-set announcement and maintenance notice. Plain text only. */
export default function SiteBanner() {
  const [state, setState] = useState<SiteState | null>(null);
  useEffect(() => {
    fetch("/api/site")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SiteState | null) => setState(d))
      .catch(() => undefined);
  }, []);
  if (!state) return null;
  const { announcement, maintenance } = state;
  return (
    <>
      {maintenance && (
        <div role="status" className="bg-[#C8102E] text-white border-b-[3px] border-black px-4 py-2 font-mono text-[12px] text-center">
          <b>BAKIM:</b> {maintenance.message || "Site kısa bir süre yalnızca okunabilir."}
        </div>
      )}
      {announcement && (
        <div
          className={`border-b-[3px] border-black px-4 py-2 font-mono text-[12px] text-center ${
            announcement.tone === "warning" ? "bg-[#C8102E] text-white" : "bg-[#FFEA00] text-black"
          }`}
        >
          {announcement.link ? (
            announcement.link.startsWith("/") ? (
              <Link href={announcement.link} className="underline">
                {announcement.text}
              </Link>
            ) : (
              <a href={announcement.link} className="underline" rel="noopener noreferrer nofollow" target="_blank">
                {announcement.text}
              </a>
            )
          ) : (
            announcement.text
          )}
        </div>
      )}
    </>
  );
}
