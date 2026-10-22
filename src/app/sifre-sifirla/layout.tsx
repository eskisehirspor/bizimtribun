import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Şifreni belirle — Bizim Tribün",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function SifreSifirlaLayout({ children }: { children: ReactNode }) {
  return children;
}
