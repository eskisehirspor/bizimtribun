import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { resolveClientIp, trustProxyFromEnv } from "./client-ip";

const testHeaderStore = new AsyncLocalStorage<Headers>();

/** Test-only: serve clientIp() from the Request headers without next/headers. */
export function runWithTestHeaders<T>(headerInit: Headers, fn: () => T): T {
  return testHeaderStore.run(headerInit, fn);
}

export const TRUST_PROXY_MISSING_ERROR =
  "TRUST_PROXY ayarlı değil: üretimde her istek aynı IP'den geliyor sayılır ve hız sınırları tüm siteyi kilitler. TRUST_PROXY=cloudflare veya forwarded ayarla.";

export async function clientIp() {
  const testHeaders = testHeaderStore.getStore();
  const trust = trustProxyFromEnv();
  // Without a trusted proxy header every visitor resolves to one address, so a
  // single person could exhaust the per-IP limits (OTP, sign-up, forum) for
  // the whole site. Refuse instead of running with shared limits.
  if (!testHeaders && trust.mode === "none" && process.env.NODE_ENV === "production") {
    throw new Error(TRUST_PROXY_MISSING_ERROR);
  }
  if (testHeaders) {
    return resolveClientIp(testHeaders, trust);
  }
  const h = await headers();
  return resolveClientIp(h, trust);
}

export function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function isBrowserSameSite(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
