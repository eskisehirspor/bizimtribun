import type { ReactNode } from "react";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Takımlar ve Taraftar Sayıları | Bizim Tribün",
  description:
    "Süper Lig'den Bölgesel Amatör Lig'e bütün takımlar: doğrulanmış taraftar sayıları, sıralama ve her takımın kendi tribünü.",
  path: "/takimlar",
});

export default function TakimlarLayout({ children }: { children: ReactNode }) {
  return children;
}
