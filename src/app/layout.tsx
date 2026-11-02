import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Space_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import SiteBanner from "@/components/SiteBanner";
import SiteFooter from "@/components/SiteFooter";
import LegalGate from "@/components/LegalGate";
import SiteNav from "@/components/SiteNav";
import { DEFAULT_SHARE_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import "./globals.css";

// Three families: Anton for display and big numbers, Archivo for reading
// and UI, Space Mono for data labels. See the tokens in globals.css.
const anton = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-anton",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-space",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "sports",
  referrer: "no-referrer",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: { siteName: SITE_NAME, locale: "tr_TR", type: "website", images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
  formatDetection: { telephone: false, email: false, address: false },
  // Optional: Search Console's HTML-tag check. The DNS check through Cloudflare needs nothing here.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#FFEA00",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${anton.variable} ${archivo.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <SiteNav />
          <SiteBanner />
          {children}
          <SiteFooter />
          <LegalGate />
        </AuthProvider>
      </body>
    </html>
  );
}
