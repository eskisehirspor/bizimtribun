import { noStoreJson } from "@/lib/http";
import { listLeagues } from "@/lib/team-catalog";
import { listMembershipTeams } from "@/lib/team-db";

export async function GET() {
  return noStoreJson({ ok: true, teams: listMembershipTeams(), leagues: listLeagues() });
}
