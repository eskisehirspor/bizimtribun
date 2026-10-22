import { NextResponse } from "next/server";
import { listLeagues, listTeamCatalog } from "@/lib/team-catalog";

export const dynamic = "force-dynamic";

/** Public team catalog (names, leagues, colours, forum flags). No user data. */
export async function GET() {
  return NextResponse.json(
    { ok: true, teams: await listTeamCatalog(), leagues: await listLeagues() },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
