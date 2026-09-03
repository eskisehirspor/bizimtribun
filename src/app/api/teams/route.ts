import { noStoreJson } from "@/lib/http";
import { listMembershipTeams } from "@/lib/team-db";

export async function GET() {
  const teams = listMembershipTeams();
  return noStoreJson({ ok: true, teams });
}
