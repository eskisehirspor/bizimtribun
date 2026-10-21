import type { NextConfig } from "next";
import { isProductionNodeEnv, securityHeaders } from "./src/lib/security-headers";

const production = isProductionNodeEnv();
const globalSecurityHeaders = securityHeaders({ production });
const noReferrer = [{ key: "Referrer-Policy", value: "no-referrer" }];

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.49"],
  async redirects() {
    // Province tribunes were removed; old links land on the province's count page.
    // Genel Tribün became the Milli Takım Tribünü.
    return [
      { source: "/forum/il/:citySlug/:rest*", destination: "/il/:citySlug", permanent: true },
      { source: "/forum/genel/:rest*", destination: "/forum/milli-takim/:rest*", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: globalSecurityHeaders },
      { source: "/dogrula", headers: noReferrer },
      { source: "/uye-dogrula", headers: noReferrer },
      { source: "/admin/:path*", headers: noReferrer },
      { source: "/api/verify", headers: noReferrer },
      { source: "/api/auth/verify-email", headers: noReferrer },
      { source: "/api/vote", headers: noReferrer },
    ];
  },
};

export default nextConfig;
