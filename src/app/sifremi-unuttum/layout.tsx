import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Şifremi unuttum — Bizim Tribün",
  robots: { index: false, follow: false },
};

export default function SifremiUnuttumLayout({ children }: { children: ReactNode }) {
  return children;
}
