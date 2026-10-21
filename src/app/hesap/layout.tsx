import type { ReactNode } from "react";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Hesabım");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
