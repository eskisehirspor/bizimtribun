import { getDb } from "@/lib/db";
import { requireAdminResponse } from "@/lib/admin-http";
import { remainingRecoveryCount } from "@/lib/admin-2fa";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;
  return noStoreJson({
    ok: true,
    enabled: Number(gate.user.totp_enabled) === 1,
    remainingRecoveryCodes: remainingRecoveryCount(getDb(), gate.user.id),
  });
}
