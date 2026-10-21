import type Database from "better-sqlite3";
import type { NextResponse } from "next/server";
import { hmac, newToken } from "./crypto";
import {
  DEVICE_COOKIE,
  DEVICE_COOKIE_MAX_AGE_SEC,
  DEVICE_SIGNUP_MAX,
  DEVICE_SIGNUP_WINDOW_MS,
} from "./policy";

/**
 * Limits how many accounts one browser can open. The browser carries a random
 * id in an httpOnly cookie; the database keeps only its HMAC and the sign-up
 * time, with no link to the account, for DEVICE_SIGNUP_WINDOW_MS.
 *
 * This stops casual repeat sign-ups from the same browser. It cannot stop
 * someone who clears cookies, uses a private window or another browser; the
 * per-IP limits, Turnstile and the throwaway-domain list cover part of that.
 */
export const DEVICE_LIMIT_ERROR = `Bu cihazdan en fazla ${DEVICE_SIGNUP_MAX} hesap açılabilir.`;
export const DEVICE_COOKIE_ERROR =
  "Üye olmak için tarayıcının çerezleri kabul etmesi gerekiyor. Çerezleri açıp kodu yeniden iste.";

export function isDeviceId(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[a-f0-9]{64}$/.test(raw);
}

export function deviceHash(raw: string) {
  return hmac(`device:${raw}`);
}

/** Sets a device id on the response when the request did not carry a valid one. */
export function ensureDeviceCookie(res: NextResponse, current: string | null | undefined) {
  if (isDeviceId(current)) return current;
  const id = newToken();
  res.cookies.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE_SEC,
  });
  return id;
}

export function deviceSignupCount(db: Database.Database, hash: string) {
  return (
    db
      .prepare(`SELECT COUNT(*) as c FROM device_signups WHERE device_hash = ? AND created_at >= ?`)
      .get(hash, new Date(Date.now() - DEVICE_SIGNUP_WINDOW_MS).toISOString()) as { c: number }
  ).c;
}

export function deviceLimitReached(db: Database.Database, hash: string) {
  return deviceSignupCount(db, hash) >= DEVICE_SIGNUP_MAX;
}

export function noteDeviceSignup(db: Database.Database, hash: string, at: string) {
  db.prepare(`INSERT INTO device_signups (device_hash, created_at) VALUES (?, ?)`).run(hash, at);
}
