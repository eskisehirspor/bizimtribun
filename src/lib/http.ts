import { NextResponse } from "next/server";
import { MAX_JSON_BYTES } from "./policy";
import { isBrowserSameSite } from "./request";
import { applySecurityHeaders } from "./security-headers";

export function noStoreJson(body: unknown, status = 200) {
  const res = NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  applySecurityHeaders(res.headers);
  return res;
}

export async function readJsonBody(req: Request) {
  if (!isBrowserSameSite(req)) {
    return { error: "Geçersiz kaynak." as const };
  }
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_JSON_BYTES) {
    return { error: "İstek çok büyük." as const };
  }
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) {
    return { error: "İstek çok büyük." as const };
  }
  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return { error: "Geçersiz istek." as const };
  }
}

export function isVerifyToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export function isOtpCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}
