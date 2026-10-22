import { noStoreJson } from "@/lib/http";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().prepare("SELECT 1").get();
    return noStoreJson({ ok: true, db: "healthy" });
  } catch {
    return noStoreJson({ ok: false, db: "unhealthy" }, 503);
  }
}
