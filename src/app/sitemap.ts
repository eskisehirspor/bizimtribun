import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/request";
import { buildPublicSitemap, staticSitemapEntries } from "@/lib/sitemap-policy";

export const dynamic = "force-dynamic";

export default function sitemap() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return staticSitemapEntries(appUrl());
  }
  return buildPublicSitemap(getDb(), appUrl());
}
