"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/uyeler", label: "Üyeler" },
  { href: "/admin/forum", label: "Forum" },
  { href: "/admin/moderasyon", label: "Moderasyon" },
  { href: "/admin/banlar", label: "Banlar" },
  { href: "/admin/takim-talepleri", label: "Takım Talepleri" },
  { href: "/admin/guvenlik", label: "Güvenlik" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[1280px] mx-auto px-3 sm:px-5 py-4 md:py-6 md:flex md:gap-5">
        <aside className="md:w-[210px] shrink-0 mb-4 md:mb-0">
          <div className="border-[4px] border-black bg-black text-[#FFEA00] p-3 shadow-[6px_6px_0_#111]">
            <p className="font-mono text-[9px] tracking-[0.22em] opacity-80">BİZİM TRİBÜN</p>
            <h1 className="font-anton text-[28px] leading-none mt-1">ADMIN</h1>
          </div>
          <nav className="mt-3 flex md:flex-col gap-2 overflow-x-auto pb-1">
            {LINKS.map((link) => {
              const active =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 border-[3px] border-black px-3 py-2 font-anton text-[14px] ${
                    active ? "bg-[#FFEA00]" : "bg-[#FFFEFA] hover:bg-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
