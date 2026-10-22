import type { ReactNode } from "react";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata("Giriş yap");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
