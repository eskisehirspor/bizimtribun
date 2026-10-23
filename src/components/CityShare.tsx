"use client";

import { useState } from "react";
import { btnAccent } from "@/components/ui";

type Props = {
  slug: string;
  headline: string;
  summary: string;
};

/** Phones and tablets share to WhatsApp; desktops copy the page link. */
function isMobile(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(nav.userAgent);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* older browsers / insecure context */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function CityShare({ slug, headline, summary }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // The browser's own origin: right on bizimtribun.com, staging and local dev alike.
    const url = `${window.location.origin}/il/${slug}`;
    if (isMobile()) {
      const text = `${headline}\n${summary}\n${url}`;
      window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      return;
    }
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={`${btnAccent} shadow-[4px_4px_0_black]`}
    >
      {copied ? "LİNK KOPYALANDI" : "PAYLAŞ"}
    </button>
  );
}
