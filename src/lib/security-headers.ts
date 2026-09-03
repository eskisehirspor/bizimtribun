export const HSTS_VALUE = "max-age=31536000; includeSubDomains";

export type SecurityHeader = { key: string; value: string };

export function isProductionNodeEnv(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

/**
 * App Router hydration still injects inline bootstrap scripts.
 * This Next 16.3.x tree has no `x-nonce` plumbing, so production
 * keeps `'unsafe-inline'` for script-src and does not use preload/HSTS extras.
 * `'unsafe-eval'` is development-only (React Refresh / Turbopack).
 */
export function contentSecurityPolicy(production: boolean): string {
  const scriptSrc = production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connectSrc = production
    ? "connect-src 'self'"
    : "connect-src 'self' ws: wss:";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(opts: {
  production: boolean;
  referrerPolicy?: string;
}): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Referrer-Policy",
      value: opts.referrerPolicy ?? "no-referrer",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(opts.production),
    },
  ];
  if (opts.production) {
    headers.push({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }
  return headers;
}

export function applySecurityHeaders(
  headers: Headers,
  opts?: { production?: boolean; referrerPolicy?: string },
) {
  const production = opts?.production ?? isProductionNodeEnv();
  for (const { key, value } of securityHeaders({
    production,
    referrerPolicy: opts?.referrerPolicy,
  })) {
    headers.set(key, value);
  }
}
