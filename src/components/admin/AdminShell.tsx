"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fieldClass, labelClass } from "@/components/ui";
import { createContext, useContext } from "react";
import type { Permission } from "@/lib/permissions";

const LINKS: Array<{ href: string; label: string; needs: Permission }> = [
  { href: "/admin", label: "Genel Bakış", needs: "admin.access" },
  { href: "/admin/uyeler", label: "Üyeler", needs: "users.view" },
  { href: "/admin/forum", label: "Forum", needs: "forum.moderate" },
  { href: "/admin/moderasyon", label: "Moderasyon", needs: "moderation.view" },
  { href: "/admin/bildirimler", label: "Üye Bildirimleri", needs: "forum.moderate" },
  { href: "/admin/banlar", label: "Banlar", needs: "users.ban" },
  { href: "/admin/takimlar", label: "Takımlar ve Sezonlar", needs: "teams.manage" },
  { href: "/admin/takim-talepleri", label: "Takım Talepleri", needs: "team_requests.manage" },
  { href: "/admin/takma-adlar", label: "Ayrılmış Takma Adlar", needs: "usernames.manage" },
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
  needs2fa = false,
}: {
  children: React.ReactNode;
  viewer: AdminViewer;
  /** Staff without TOTP may only use the security page (the API enforces this too). */
  needs2fa?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = LINKS.filter(
    (link) => viewer.permissions.includes(link.needs) && (!needs2fa || link.needs === "security.self"),
  );
  const blocked = needs2fa && !pathname.startsWith("/admin/guvenlik");
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = links.find((l) => isActive(l.href))?.href ?? "/admin";

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-black relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.16] mix-blend-multiply paper-bg" />
      <div className="relative z-10 max-w-[1280px] mx-auto px-3 sm:px-5 py-4 md:py-6 md:flex md:gap-5">
        <aside className="md:w-[210px] shrink-0 mb-4 md:mb-0">
          <div className="border-[4px] border-black bg-black text-[#FFEA00] p-3 shadow-[6px_6px_0_#111]">
            <p className="font-mono text-[11px] tracking-[0.22em] opacity-80">BİZİM TRİBÜN</p>
            <h1 className="font-anton text-[28px] leading-[1.05] mt-1">ADMIN</h1>
            <p className="font-mono text-[12px] mt-1">{viewer.roleLabel.toLocaleUpperCase("tr-TR")}</p>
          </div>
          <Link
            href="/"
            className="mt-3 inline-flex min-h-11 items-center font-mono text-[13px] underline underline-offset-4 decoration-2"
          >
            ← Siteye dön
          </Link>
          <label className="mt-2 block md:hidden">
            <span className={labelClass}>BÖLÜM</span>
            <select
              className={`mt-1 ${fieldClass}`}
              value={current}
              onChange={(e) => router.push(e.target.value)}
            >
              {links.map((link) => (
                <option key={link.href} value={link.href}>
                  {link.label}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Yönetim bölümleri" className="mt-2 hidden md:flex md:flex-col gap-2">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center border-[3px] border-black px-3 py-2 font-anton text-[14px] ${
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
          {needs2fa && (
            <div role="alert" className="mb-4 border-[4px] border-black bg-[#FFEA00] p-4 shadow-[6px_6px_0_black]">
              <p className="font-anton text-[22px] leading-[1.05]">ÖNCE 2FA&apos;YI AÇ</p>
              <p className="font-mono text-[13px] mt-2">
                Yönetim paneli iki adımlı doğrulama olmadan açılmaz. Telefonuna bir doğrulama uygulaması (Google
                Authenticator, Authy, 1Password…) kur, Güvenlik sayfasındaki anahtarı uygulamaya elle ekle ve uygulamanın verdiği 6 haneli
                kodu yaz. Kurtarma kodlarını güvenli bir yere kaydet.
              </p>
              {blocked && (
                <Link
                  href="/admin/guvenlik"
                  className="mt-3 inline-flex min-h-11 items-center border-[3px] border-black bg-black px-4 font-anton text-[15px] text-white"
                >
                  GÜVENLİK SAYFASINA GİT
                </Link>
              )}
            </div>
          )}
          {!blocked && <AdminViewerContext.Provider value={viewer}>{children}</AdminViewerContext.Provider>}
        </main>
      </div>
    </div>
  );
}
