/** Crawler policy only. Does not replace server-side auth or requireAdmin(). */

export const ROBOTS_ALLOW = ["/", "/il/", "/takimlar", "/takim/", "/forum/"] as const;

export const ROBOTS_DISALLOW = [
  "/admin",
  "/api/",
  "/giris",
  "/uye-ol",
  "/takim-talep",
  "/dogrula",
  "/uye-dogrula",
  "/sil-verilerim",
  "/takim/*/forum/yeni",
] as const;

export function robotsMetadata(appBase: string) {
  const base = appBase.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: [...ROBOTS_ALLOW],
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

function pathOnly(urlOrPath: string) {
  try {
    if (urlOrPath.includes("://")) {
      return new URL(urlOrPath).pathname;
    }
  } catch {
    /* fall through */
  }
  const noHash = urlOrPath.split("#")[0] || "/";
  return (noHash.split("?")[0] || "/") as string;
}

function globToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}`);
}

/** Longest matching Allow/Disallow rule wins (Google robots.txt). */
export function robotsPathDecision(urlOrPath: string): "allow" | "disallow" {
  const pathname = pathOnly(urlOrPath);
  let best: { kind: "allow" | "disallow"; len: number } = {
    kind: "allow",
    len: 0,
  };
  for (const rule of ROBOTS_ALLOW) {
    if (globToRegExp(rule).test(pathname) && rule.length >= best.len) {
      best = { kind: "allow", len: rule.length };
    }
  }
  for (const rule of ROBOTS_DISALLOW) {
    if (globToRegExp(rule).test(pathname) && rule.length >= best.len) {
      best = { kind: "disallow", len: rule.length };
    }
  }
  return best.kind;
}

export function sitemapHasPrivatePath(urls: string[]) {
  return urls.some((url) => robotsPathDecision(url) === "disallow");
}
