import { usernameProblem } from "@/lib/accounts";
import { getDb } from "@/lib/db";
import { noStoreJson } from "@/lib/http";
import { findUserByUsernameNorm, normalizeUsername } from "@/lib/users";

/** Lets the sign-up form say early whether a username can be taken. */
export async function GET(req: Request) {
  const usernameNorm = normalizeUsername(new URL(req.url).searchParams.get("name") ?? "");
  const problem = await usernameProblem(getDb(), usernameNorm);
  if (problem) return noStoreJson({ ok: true, available: false, error: problem.error });
  if (await findUserByUsernameNorm(usernameNorm)) {
    return noStoreJson({ ok: true, available: false, error: "Bu kullanıcı adı alınmış." });
  }
  return noStoreJson({ ok: true, available: true });
}
