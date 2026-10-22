import type { ReactNode } from "react";
import JsonLd from "@/components/JsonLd";
import { NATIONAL_BOARD_NAME, NATIONAL_BOARD_PATH } from "@/lib/national-board";
import { HOME_CRUMB, breadcrumbJsonLd, graph, publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: `${NATIONAL_BOARD_NAME} | Bizim Tribün`,
  description:
    "Ay yıldızlılar, milli maçlar, kadro ve takım ayırmadan futbol gündemi. Her takımdan doğrulanmış taraftarın yazdığı açık tribün.",
  path: NATIONAL_BOARD_PATH,
});

export default function MilliTakimLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd([
            HOME_CRUMB,
            { name: "Tribün", path: "/forum" },
            { name: NATIONAL_BOARD_NAME, path: NATIONAL_BOARD_PATH },
          ]),
        )}
      />
      {children}
    </>
  );
}
