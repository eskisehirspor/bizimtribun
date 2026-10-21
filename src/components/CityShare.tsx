"use client";

import { useState } from "react";
import { cityCanonical } from "@/lib/city-seo";
import { btnAccent } from "@/components/ui";

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
      className={`${btnAccent} shadow-[4px_4px_0_black]`}
    >
      {copied ? "KOPYALANDI" : "PAYLAŞ"}
    </button>
  );
}
