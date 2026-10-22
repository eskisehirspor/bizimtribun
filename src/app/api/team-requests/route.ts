import { z } from "zod";
import { clientIp } from "@/lib/request";
import { noStoreJson, readJsonBody } from "@/lib/http";
import { getSessionUser, requireActiveUser } from "@/lib/auth";
import { hashedIp, registerAttemptCount } from "@/lib/stats";
import { hmac } from "@/lib/crypto";
import { noteAuthAttempt } from "@/lib/users";
import {
  TEAM_REQUEST_MESSAGE_MAX,
  TEAM_REQUEST_NAME_MAX,
} from "@/lib/policy";
import { getDb } from "@/lib/db";
import {
  createTeamRequest,
  isTeamRequestRateLimited,
} from "@/lib/team-requests";
import { getSettings, MAINTENANCE_ERROR, maintenanceBlocks } from "@/lib/site-settings";

const Body = z.object({
  teamName: z.string().min(1).max(TEAM_REQUEST_NAME_MAX + 20),
  city: z.string().min(1).max(40),
  message: z.string().min(1).max(TEAM_REQUEST_MESSAGE_MAX + 20),
});

export async function POST(req: Request) {
  const body = await readJsonBody(req);
  if ("error" in body) {
    return noStoreJson({ error: body.error }, 400);
  }

  const active = requireActiveUser(await getSessionUser(req));
  if (!active.ok) {
    return noStoreJson({ error: active.error }, active.status);
  }
  if (await maintenanceBlocks(active.user.role)) return noStoreJson({ error: MAINTENANCE_ERROR }, 503);
  if (!(await getSettings()).features.teamRequestsOpen) {
    return noStoreJson({ error: "Takım talepleri şu an kapalı." }, 403);
  }

  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return noStoreJson({ error: "Talep bilgileri eksik veya geçersiz." }, 400);
  }

  const ip = await clientIp();
  const ipHash = hashedIp(`team-req:${ip}`);
  const userHash = hmac(`team-req-user:${active.user.id}`);
  if (
    isTeamRequestRateLimited(
      await registerAttemptCount(ipHash),
      await registerAttemptCount(userHash),
    )
  ) {
    return noStoreJson({ error: "Çok fazla talep. Biraz sonra dene." }, 429);
  }
  await noteAuthAttempt(ipHash);
  await noteAuthAttempt(userHash);

  const result = await createTeamRequest(getDb(), active.user.id, parsed.data);
  if (!result.ok) {
    return noStoreJson({ error: result.error }, result.status);
  }

  return noStoreJson(
    {
      ok: true,
      request: {
        id: result.id,
        teamName: result.teamName,
        city: result.city,
        status: result.status,
      },
    },
    201,
  );
}
