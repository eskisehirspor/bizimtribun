import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { resolveClientIp, trustProxyFromEnv } from "./client-ip";

const testHeaderStore = new AsyncLocalStorage<Headers>();

/** Test-only: serve clientIp() from the Request headers without next/headers. */
export function runWithTestHeaders<T>(headerInit: Headers, fn: () => T): T {
  return testHeaderStore.run(headerInit, fn);
}

export async function clientIp() {
  const testHeaders = testHeaderStore.getStore();
  const trust = trustProxyFromEnv();
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
