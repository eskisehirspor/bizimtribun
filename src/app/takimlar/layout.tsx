import type { ReactNode } from "react";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Taraftar Sayıları: En Çok Taraftarı Olan Takımlar | Bizim Tribün",
  description:
    "Hangi takımın kaç taraftarı var? Süper Lig'den Bölgesel Amatör Lig'e bütün takımların doğrulanmış taraftar sayıları, Türkiye sıralaması ve tribünleri.",
  path: "/takimlar",
});

export default function TakimlarLayout({ children }: { children: ReactNode }) {
  return children;
}
