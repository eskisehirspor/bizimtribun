import { isIP } from "node:net";

export type TrustProxyMode = "none" | "cloudflare" | "forwarded";

export const DEV_UNRESOLVED_IP = "127.0.0.1";
export const PROD_UNRESOLVED_IP = "0.0.0.0";

type HeaderBag = { get(name: string): string | null };

export function parseTrustProxyMode(raw: string | undefined | null): TrustProxyMode {
  const v = (raw || "").trim().toLowerCase();
  if (v === "cloudflare" || v === "cf") return "cloudflare";
  if (v === "forwarded" || v === "nginx") return "forwarded";
  return "none";
}

export function parseTrustProxyHops(raw: string | undefined | null) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

export function unresolvedClientIp(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production" ? PROD_UNRESOLVED_IP : DEV_UNRESOLVED_IP;
}

export function parseIpCandidate(raw: string | null | undefined) {
  if (!raw) return null;
  let value = raw.trim();
  if (value.length < 2 || value.length > 64) return null;
  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  } else {
    const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
    if (v4port) value = v4port[1]!;
  }
  if (isIP(value) === 0) return null;
  return value;
}

function forwardedIps(header: string | null) {
  if (!header) return [] as string[];
  const out: string[] = [];
  for (const part of header.split(",")) {
    const ip = parseIpCandidate(part);
    if (ip) out.push(ip);
  }
  return out;
}

function fromForwarded(header: string | null, hops: number) {
  const chain = forwardedIps(header);
  if (chain.length === 0) return null;
  const idx = chain.length - hops;
  if (idx < 0) return null;
  return chain[idx] ?? null;
}

export function resolveClientIp(
  headers: HeaderBag,
  options: {
    mode: TrustProxyMode;
    hops?: number;
    fallback: string;
  },
) {
  const fallback = parseIpCandidate(options.fallback) || PROD_UNRESOLVED_IP;
  const hops = options.hops ?? 1;

  if (options.mode === "cloudflare") {
    return parseIpCandidate(headers.get("cf-connecting-ip")) || fallback;
  }

  if (options.mode === "forwarded") {
    const fromXff = fromForwarded(headers.get("x-forwarded-for"), hops);
    if (fromXff) return fromXff;
    const real = parseIpCandidate(headers.get("x-real-ip"));
    if (real) return real;
    return fallback;
  }

  return fallback;
}

export function trustProxyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { mode: TrustProxyMode; hops: number; fallback: string } {
  return {
    mode: parseTrustProxyMode(env.TRUST_PROXY),
    hops: parseTrustProxyHops(env.TRUST_PROXY_HOPS),
    fallback: unresolvedClientIp(env.NODE_ENV),
  };
}
