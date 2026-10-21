/**
 * Bot protection for SMS sends (Cloudflare Turnstile).
 *
 * TURNSTILE_SECRET_KEY (server) + NEXT_PUBLIC_TURNSTILE_SITE_KEY (browser).
 * Production without a secret fails closed. Development and tests skip the
 * check unless a secret is configured.
 */
export type CaptchaResult = { ok: true } | { ok: false; reason: "missing" | "invalid" | "unconfigured" | "network" };

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function captchaRequired(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim()) || env.NODE_ENV === "production";
}

export function captchaSiteKey(env: NodeJS.ProcessEnv = process.env) {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}

export async function verifyCaptcha(
  token: unknown,
  remoteIp: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CaptchaResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return env.NODE_ENV === "production" ? { ok: false, reason: "unconfigured" } : { ok: true };
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) {
    return { ok: false, reason: "missing" };
  }
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(6_000),
    });
    const data = (await res.json().catch(() => null)) as { success?: unknown } | null;
    return data?.success === true ? { ok: true } : { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "network" };
  }
}
