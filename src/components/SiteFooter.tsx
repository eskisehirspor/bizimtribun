"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Social = { x: string; instagram: string; youtube: string; tiktok: string };
const SOCIAL_LABEL = { x: "X", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok" } as const;

const linkClass =
  "inline-flex min-h-10 items-center text-[14px] text-white/80 underline-offset-4 hover:text-volt hover:underline";
const headClass = "font-mono text-[12px] uppercase tracking-[0.12em] text-white/60";

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
    <footer className="relative z-10 border-t-[3px] border-line bg-ink text-surface">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:px-8">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center font-anton text-[22px] leading-none text-volt">
            BİZİM <span className="ml-1 bg-volt px-1 pt-0.5 text-ink">TRİBÜN</span>
          </Link>
          <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-white/80">
            Takımının gerçek gücünü Bizim Tribün&apos;de göster. Sen varsan +1 kişi fazlayız. Haydi katıl!
          </p>
        </div>
        <nav aria-label="Keşfet">
          <p className={headClass}>Keşfet</p>
          <ul className="mt-2">
            <li>
              <Link href="/" className={linkClass}>
                Sayım ve harita
              </Link>
            </li>
            <li>
              <Link href="/forum" className={linkClass}>
                Tribün
              </Link>
            </li>
            <li>
              <Link href="/takimlar" className={linkClass}>
                Takım tribünleri
              </Link>
            </li>
            <li>
              <Link href="/blog" className={linkClass}>
                Tribün Notları (blog)
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Yasal">
          <p className={headClass}>Yasal ve gizlilik</p>
          <ul className="mt-2">
            <li>
              <Link href="/kullanim-kosullari" className={linkClass}>
                Kullanım koşulları
              </Link>
            </li>
            <li>
              <Link href="/kvkk" className={linkClass}>
                KVKK aydınlatma
              </Link>
            </li>
            <li>
              <Link href="/cerez-politikasi" className={linkClass}>
                Çerez politikası
              </Link>
            </li>
            <li>
              <Link href="/sil-verilerim" className={linkClass}>
                Verilerimi sil
              </Link>
            </li>
          </ul>
        </nav>
        {social && (Object.keys(SOCIAL_LABEL) as (keyof typeof SOCIAL_LABEL)[]).some((key) => social[key]) && (
          <nav aria-label="Sosyal medya">
            <p className={headClass}>Takip et</p>
            <ul className="mt-2">
              {(Object.keys(SOCIAL_LABEL) as (keyof typeof SOCIAL_LABEL)[])
                .filter((key) => social[key])
                .map((key) => (
                  <li key={key}>
                    <a href={social[key]} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      {SOCIAL_LABEL[key]}
                    </a>
                  </li>
                ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-[1240px] px-4 py-4 font-mono text-[12px] text-white/60 md:px-8">
          © Bizim Tribün
        </p>
      </div>
    </footer>
  );
}
