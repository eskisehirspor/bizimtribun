"use client";

import { useState } from "react";
import { cityCanonical } from "@/lib/city-seo";

type Props = {
  slug: string;
  headline: string;
  summary: string;
};

export default function CityShare({ slug, headline, summary }: Props) {
  const [copied, setCopied] = useState(false);
  const url = cityCanonical(slug);

  async function share() {
    const text = `${headline}\n${summary}\n${url}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: headline, text: summary, url });
        return;
      } catch {
        /* fallback */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="font-anton text-[14px] border-[3px] border-black bg-[#FFEA00] px-4 py-2 shadow-[4px_4px_0_black]"
    >
      {copied ? "KOPYALANDI" : "PAYLAŞ"}
    </button>
  );
}
