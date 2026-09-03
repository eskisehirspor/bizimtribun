import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "E-posta doğrula — Bizim Tribün",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function UyeDogrulaLayout({ children }: { children: ReactNode }) {
  return children;
}
