import type { Metadata } from "next";
import { Anton, Bangers, Caveat, Kalam, Space_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-anton",
});

const marker = Kalam({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-marker",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-space",
});

const hand = Caveat({
  weight: "700",
  subsets: ["latin", "latin-ext"],
  variable: "--font-hand",
});

const ultras = Bangers({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-ultras",
});

export const metadata: Metadata = {
  title: "Bizim Tribün — En büyük kim?",
  description:
    "Türkiye tribünlerinin gerçek sayımı. E-posta doğrulamalı, IP sınırlı, KVKK’ya uygun taraftar kaydı.",
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${anton.variable} ${marker.variable} ${mono.variable} ${hand.variable} ${ultras.variable} h-full`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <SiteNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
