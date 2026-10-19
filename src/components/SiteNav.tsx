"use client";

import { isStaffRole } from "@/lib/permissions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function SiteNav() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const next = pathname && pathname !== "/giris" && pathname !== "/uye-ol"
    ? `?next=${encodeURIComponent(pathname)}`
    : "";
  const inTribun = pathname.startsWith("/takim") || pathname.startsWith("/forum");
  const switchHref = inTribun ? "/" : "/takimlar";
  const switchLabel = inTribun ? "SAYIM" : "TRİBÜNE GEÇ";

  return (
    <nav className="relative z-40 border-b-[4px] border-black bg-black text-[#FFEA00]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-5 md:px-8 h-12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={switchHref}
            className="sm:hidden shrink-0 font-anton text-[13px] border-[2px] border-[#FFEA00] bg-[#FFEA00] text-black px-2.5 py-1"
          >
            {switchLabel}
          </Link>
          <div className="hidden sm:flex items-center gap-3 font-anton text-[13px]">
            <Link
              href="/"
              className={pathname === "/" ? "underline decoration-2" : "opacity-80 hover:opacity-100"}
            >
              SAYIM
            </Link>
            <Link
              href="/takimlar"
              className={
                pathname.startsWith("/takim") || pathname.startsWith("/forum")
                  ? "underline decoration-2"
                  : "opacity-80 hover:opacity-100"
              }
            >
              TRİBÜN
            </Link>
            {isStaffRole(user?.role) && (
              <Link
                href="/admin"
                className={
                  pathname.startsWith("/admin")
                    ? "underline decoration-2"
                    : "opacity-80 hover:opacity-100"
                }
              >
                ADMIN
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] sm:text-[12px]">
          {isStaffRole(user?.role) && (
            <Link href="/admin" className="sm:hidden opacity-80">
              ADMIN
            </Link>
          )}
          {loading ? (
            <span className="opacity-50">…</span>
          ) : user ? (
            <div className="relative flex items-center gap-2">
              {(!user.phoneVerified || !user.voteTeamId) && (
                <Link
                  href="/takim-sec"
                  title={user.phoneVerified ? "Takımını seç" : "Telefonunu doğrula"}
                  aria-label={user.phoneVerified ? "Takımını seç" : "Telefonunu doğrula"}
                  className="relative shrink-0"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-[2px] border-[#FFEA00] bg-[#C8102E] font-anton text-[13px] text-white">
                    !
                  </span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="border-[2px] border-[#FFEA00] px-2 py-1 font-anton text-[12px] max-w-[140px] truncate"
              >
                {user.username}
              </button>
              {open && (
                <div className="absolute right-0 mt-1 w-[180px] border-[3px] border-black bg-[#FFFEFA] text-black shadow-[4px_4px_0_black] p-2 z-50">
                  <p className="font-mono text-[10px] opacity-60 truncate">
                    {user.username}
                  </p>
                  <Link
                    href="/hesap"
                    onClick={() => setOpen(false)}
                    className="mt-2 block font-mono text-[11px] border-[2px] border-black px-2 py-1 bg-white"
                  >
                    Hesabım
                  </Link>
                  {!user.phoneVerified && (
                    <Link
                      href="/takim-sec"
                      onClick={() => setOpen(false)}
                      className="mt-2 block font-mono text-[11px] border-[2px] border-black px-2 py-1 bg-[#FFEA00]"
                    >
                      Telefonunu doğrula
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                    className="mt-2 w-full text-left font-anton text-[13px] border-[2px] border-black px-2 py-1 bg-white"
                  >
                    ÇIKIŞ YAP
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href={`/giris${next}`}
                className="font-anton text-[12px] sm:text-[13px] border-[2px] border-[#FFEA00] px-2 py-1"
              >
                GİRİŞ YAP
              </Link>
              <Link
                href={`/uye-ol${next}`}
                className="font-anton text-[12px] sm:text-[13px] bg-[#FFEA00] text-black px-2 py-1"
              >
                ÜYE OL
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
