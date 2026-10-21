"use client";

import { isStaffRole } from "@/lib/permissions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function SiteNav() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const userId = user?.id ?? null;
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the account menu on outside tap or Escape; focus the first item when it opens.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const nextAt = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[nextAt]?.focus();
  }

  useEffect(() => {
    if (!userId) return;
    let live = true;
    const load = () =>
      fetch("/api/notifications?count=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (live && d && typeof d.unread === "number") setUnread(d.unread);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [userId, pathname]);
  const next = pathname && pathname !== "/giris" && pathname !== "/uye-ol"
    ? `?next=${encodeURIComponent(pathname)}`
    : "";
  const inTribun = pathname.startsWith("/takim") || pathname.startsWith("/forum");
  const inAdmin = pathname.startsWith("/admin");
  const isStaff = isStaffRole(user?.role);
  const myBoard = user?.voteTeamId ? `/takim/${user.voteTeamId}/forum` : null;

  const tab = (active: boolean) =>
    `inline-flex min-h-11 flex-1 sm:flex-none items-center justify-center px-3 font-anton text-[14px] border-[2px] ${
      active
        ? "bg-[#FFEA00] text-black border-[#FFEA00]"
        : "border-[#FFEA00]/40 text-[#FFEA00] hover:border-[#FFEA00]"
    }`;
  const chip =
    "inline-flex min-h-10 items-center justify-center px-3 font-anton text-[13px] border-[2px] border-[#FFEA00]";
  const item =
    "flex w-full min-h-11 items-center px-3 font-mono text-[14px] border-[2px] border-black bg-white hover:bg-[#FFEA00]/50 text-left";

  return (
    <nav aria-label="Ana menü" className="relative z-40 border-b-[4px] border-black bg-black text-[#FFEA00]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-5 md:px-8 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          href="/"
          aria-label="Bizim Tribün ana sayfa"
          className="order-1 shrink-0 inline-flex min-h-11 items-center font-anton text-[18px] leading-[1.2] tracking-tight text-[#FFEA00] whitespace-nowrap"
        >
          BİZİM <span className="ml-1 bg-[#FFEA00] text-black px-1 pt-0.5">TRİBÜN</span>
        </Link>
        <div className="order-3 w-full sm:order-2 sm:w-auto flex gap-1.5">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={tab(pathname === "/" || pathname.startsWith("/il/"))}>
            SAYIM
          </Link>
          <Link href="/forum" aria-current={inTribun ? "page" : undefined} className={tab(inTribun)}>
            TRİBÜN
          </Link>
          {isStaff && (
            <Link href="/admin" aria-current={inAdmin ? "page" : undefined} className={tab(inAdmin)}>
              ADMIN
            </Link>
          )}
        </div>
        <div className="order-2 sm:order-3 ml-auto flex items-center gap-2">
          {loading ? (
            <span className="font-mono text-[13px] opacity-60" aria-label="Yükleniyor">
              …
            </span>
          ) : user ? (
            <>
              <Link
                href="/bildirimler"
                aria-label={unread ? `${unread} okunmamış bildirim` : "Bildirimler"}
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center text-[16px] border-[2px] border-[#FFEA00]"
              >
                <span aria-hidden="true">🔔</span>
                {unread > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 rounded-full bg-[#C8102E] text-white font-mono text-[11px] leading-[20px] text-center"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              {(!user.verified || !user.voteTeamId) && (
                <Link
                  href="/takim-sec"
                  title={user.verified ? "Takımını seç" : "Hesabını doğrula"}
                  aria-label={user.verified ? "Takımını seç" : "Hesabını doğrula"}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-[2px] border-[#FFEA00] bg-[#C8102E] font-anton text-[15px] text-white">
                    !
                  </span>
                </Link>
              )}
              <div ref={menuRef} className="relative">
                <button
                  ref={toggleRef}
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  aria-controls={open ? "site-user-menu" : undefined}
                  className={`${chip} max-w-[120px] sm:max-w-[180px] ${open ? "bg-[#FFEA00] text-black" : ""}`}
                >
                  <span className="truncate">{user.username}</span>
                  <span aria-hidden="true" className="ml-1">
                    ▾
                  </span>
                </button>
                {open && (
                  <div
                    id="site-user-menu"
                    role="menu"
                    aria-label="Hesap menüsü"
                    onKeyDown={onMenuKey}
                    className="absolute right-0 top-full mt-2 w-[230px] border-[3px] border-black bg-[#FFFEFA] text-black shadow-[4px_4px_0_black] p-2 z-50 space-y-1.5"
                  >
                    <p className="font-mono text-[12px] opacity-70 truncate px-1">@{user.username}</p>
                    <Link role="menuitem" href={`/u/${encodeURIComponent(user.username)}`} onClick={() => setOpen(false)} className={item}>
                      Profilim
                    </Link>
                    {myBoard && (
                      <Link role="menuitem" href={myBoard} onClick={() => setOpen(false)} className={item}>
                        Tribünüm
                      </Link>
                    )}
                    <Link role="menuitem" href="/bildirimler" onClick={() => setOpen(false)} className={item}>
                      Bildirimler{unread ? ` (${unread})` : ""}
                    </Link>
                    <Link role="menuitem" href="/hesap" onClick={() => setOpen(false)} className={item}>
                      Hesabım
                    </Link>
                    {!user.verified && (
                      <Link
                        role="menuitem"
                        href="/takim-sec"
                        onClick={() => setOpen(false)}
                        className={`${item} bg-[#FFEA00]`}
                      >
                        Hesabını doğrula
                      </Link>
                    )}
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void logout();
                      }}
                      className={`${item} font-anton`}
                    >
                      ÇIKIŞ YAP
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href={`/giris${next}`} className={chip}>
                GİRİŞ YAP
              </Link>
              <Link href={`/uye-ol${next}`} className={`${chip} bg-[#FFEA00] text-black`}>
                ÜYE OL
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
