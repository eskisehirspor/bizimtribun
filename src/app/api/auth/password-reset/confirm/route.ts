import { z } from "zod";
import { PASSWORD_RULE_ERROR } from "@/lib/accounts";
import { isVerifyToken, noStoreJson, readJsonBody } from "@/lib/http";
import { consumePasswordReset } from "@/lib/password-reset";

const Body = z.object({ token: z.string().max(128), password: z.string().max(128) }).strict();

/** Sets the new password from the link in the reset mail. */
export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) return noStoreJson({ error: body.error }, 400);
  const parsed = Body.safeParse(body.data);
  if (!parsed.success || !isVerifyToken(parsed.data.token)) {
    return noStoreJson({ error: "Link geçersiz." }, 400);
  }
  const result = await consumePasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return noStoreJson({ error: result.error === "weak" ? PASSWORD_RULE_ERROR : result.error }, result.status);
  }
  const res = noStoreJson({ ok: true });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
