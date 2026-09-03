import { noStoreJson } from "@/lib/http";
import { getDb } from "@/lib/db";
import { evaluateDbHealth } from "@/lib/db-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const healthy = evaluateDbHealth(getDb());
    if (!healthy) {
      return noStoreJson({ ok: false, db: "unhealthy" }, 503);
    }
    return noStoreJson({ ok: true, db: "healthy" });
  } catch {
    return noStoreJson({ ok: false, db: "unhealthy" }, 503);
  }
}
