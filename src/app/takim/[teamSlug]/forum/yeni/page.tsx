"use client";

import { useParams } from "next/navigation";
import ForumNewTopicView from "@/components/forum/ForumNewTopicView";
import TeamMark from "@/components/TeamMark";
import { useTeamCatalog } from "@/components/useTeamCatalog";
import { tribunTitle } from "@/lib/forum-category";

export default function YeniKonuPage() {
  const rawSlug = useParams<{ teamSlug: string }>().teamSlug;
  const teamSlug = (Array.isArray(rawSlug) ? rawSlug[0] : rawSlug) || "";
  const team = useTeamCatalog().getTeam(teamSlug);
  return (
    <ForumNewTopicView
      apiPath={`/api/forum/teams/${teamSlug}/topics`}
      boardPath={`/takim/${teamSlug}/forum`}
      boardTitle={team ? tribunTitle(team.name) : "Tribün"}
      active={Boolean(team?.isForumActive)}
      mark={team ? <TeamMark team={team} size={44} /> : null}
      teamId={teamSlug}
    />
  );
}
