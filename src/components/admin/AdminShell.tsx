"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";

const LINKS: Array<{ href: string; label: string; needs: Permission }> = [
  { href: "/admin", label: "Dashboard", needs: "admin.access" },
  { href: "/admin/uyeler", label: "Üyeler", needs: "users.view" },
  { href: "/admin/forum", label: "Forum", needs: "forum.moderate" },
  { href: "/admin/moderasyon", label: "Moderasyon", needs: "moderation.view" },
  { href: "/admin/bildirimler", label: "Üye Bildirimleri", needs: "forum.moderate" },
  { href: "/admin/banlar", label: "Banlar", needs: "users.ban" },
  { href: "/admin/takimlar", label: "Takımlar ve Sezonlar", needs: "teams.manage" },
  { href: "/admin/takim-talepleri", label: "Takım Talepleri", needs: "team_requests.manage" },
  { href: "/admin/ayarlar", label: "Site Ayarları", needs: "content.manage" },
  { href: "/admin/denetim", label: "Denetim Kaydı", needs: "audit.view" },
  { href: "/admin/guvenlik", label: "Güvenlik", needs: "security.self" },
];

type AdminViewer = { role: string; roleLabel: string; permissions: Permission[] };

const AdminViewerContext = createContext<AdminViewer>({
  role: "user",
  roleLabel: "",
  permissions: [],
});

/** UI hint only; the API checks the same permission on every request. */
export function useAdminCan() {
  const viewer = useContext(AdminViewerContext);
  return (permission: Permission) => viewer.permissions.includes(permission);
}

export function useAdminViewer() {
  return useContext(AdminViewerContext);
}

export default function AdminShell({
  children,
  viewer,
}: {
  children: React.ReactNode;
  viewer: AdminViewer;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[1280px] mx-auto px-3 sm:px-5 py-4 md:py-6 md:flex md:gap-5">
        <aside className="md:w-[210px] shrink-0 mb-4 md:mb-0">
          <div className="border-[4px] border-black bg-black text-[#FFEA00] p-3 shadow-[6px_6px_0_#111]">
            <p className="font-mono text-[9px] tracking-[0.22em] opacity-80">BİZİM TRİBÜN</p>
            <h1 className="font-anton text-[28px] leading-none mt-1">ADMIN</h1>
            <p className="font-mono text-[10px] mt-1">{viewer.roleLabel.toLocaleUpperCase("tr-TR")}</p>
          </div>
          <nav className="mt-3 flex md:flex-col gap-2 overflow-x-auto pb-1">
            {LINKS.filter((link) => viewer.permissions.includes(link.needs)).map((link) => {
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
        <main className="min-w-0 flex-1">
          <AdminViewerContext.Provider value={viewer}>{children}</AdminViewerContext.Provider>
        </main>
      </div>
    </div>
  );
}
