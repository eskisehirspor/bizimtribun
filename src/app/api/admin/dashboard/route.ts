import { requireAdminResponse } from "@/lib/admin-http";
import { getDashboardStats } from "@/lib/admin-service";
import { noStoreJson } from "@/lib/http";

export async function GET(req: Request) {
  const gate = await requireAdminResponse(req);
  if (!gate.ok) return gate.res;
  return noStoreJson({ ok: true, ...getDashboardStats() });
}
