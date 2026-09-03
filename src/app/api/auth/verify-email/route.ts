import { noStoreJson, readJsonBody, isVerifyToken } from "@/lib/http";
import { consumeUserEmailToken } from "@/lib/user-email";

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const token = (body.data as { token?: unknown })?.token;
  if (!isVerifyToken(token)) {
    return noStoreJson({ error: "Link geçersiz." }, 400);
  }

  const result = consumeUserEmailToken(token);
  if (!result.ok) {
    const status = result.error === "Hesap askıya alınmış." ? 403 : 400;
    return noStoreJson({ error: result.error }, status);
  }

  const res = noStoreJson({ ok: true });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
