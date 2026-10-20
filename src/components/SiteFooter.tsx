"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Social = { x: string; instagram: string; youtube: string; tiktok: string };
const SOCIAL_LABEL = { x: "X", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok" } as const;

const linkClass =
  "inline-flex min-h-10 items-center border-[2px] border-white/40 px-3 font-mono text-[13px] hover:border-[#FFEA00] hover:text-[#FFEA00]";

/** Site-wide footer: legal links, data deletion and the admin-set social accounts. */
export default function SiteFooter() {
  const pathname = usePathname();
  const [social, setSocial] = useState<Social | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/site")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.socialLinks) setSocial(d.socialLinks as Social);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  // The admin area has its own frame.
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="relative z-10 border-t-[4px] border-black">
      <div className="h-8 pitch-foot border-b-[4px] border-black" />
      <div className="bg-[#111] text-[#F2EFE6] px-4 md:px-6 py-6">
        <div className="max-w-[1320px] mx-auto flex flex-wrap justify-between gap-4">
          <div>
            <div className="font-anton text-[28px]">MANİFESTO — BODRUM KAT</div>
            <p className="font-mono text-[13px] max-w-[640px] mt-2 opacity-80">
              Takımının gerçek gücünü Bizim Tribün&apos;de göster. Sen varsan +1 kişi fazlayız. Haydi
              katıl!
            </p>
          </div>
          <nav aria-label="Alt menü" className="flex flex-wrap gap-2 h-fit">
            <Link href="/forum" className={linkClass}>
              Tribün
            </Link>
            <Link href="/takimlar" className={linkClass}>
              Takım tribünleri
            </Link>
            <Link href="/kullanim-kosullari" className={linkClass}>
              Kullanım koşulları
            </Link>
            <Link href="/kvkk" className={linkClass}>
              KVKK aydınlatma
            </Link>
            <Link href="/sil-verilerim" className={linkClass}>
              Verilerimi sil
            </Link>
            {social &&
              (Object.keys(SOCIAL_LABEL) as (keyof typeof SOCIAL_LABEL)[])
                .filter((key) => social[key])
                .map((key) => (
                  <a
                    key={key}
                    href={social[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {SOCIAL_LABEL[key]}
                  </a>
                ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
