"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FORUM_ACTIVE_TEAM_IDS,
  LEAGUE_LABEL,
  getTeam as getSeedTeam,
  resolveTeamAlias,
  type Team,
} from "@/lib/teams";

export type ClientCatalogTeam = Team & { isActive: boolean; isForumActive: boolean };
type Catalog = { teams: ClientCatalogTeam[]; leagues: { id: string; name: string }[] };

let cache: Catalog | null = null;
let inflight: Promise<Catalog | null> | null = null;

function loadCatalog() {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch("/api/teams/catalog")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && Array.isArray(d.teams)) cache = { teams: d.teams, leagues: d.leagues ?? [] };
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export type TeamLookup = (id: string) => ClientCatalogTeam | undefined;

/** Seed-only lookup, used until the database catalog has loaded. */
export const seedTeamLookup: TeamLookup = (id) => {
  const team = getSeedTeam(id);
  return team
    ? { ...team, isActive: true, isForumActive: FORUM_ACTIVE_TEAM_IDS.includes(team.id) }
    : undefined;
};

/**
 * The admin-managed team catalog on the client. Renders with the code seed
 * first, then switches to database values (names, colours, forum flags).
 * The server still enforces forum and vote rules on every write.
 */
export function useTeamCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(cache);
  useEffect(() => {
    if (cache) return;
    let live = true;
    void loadCatalog().then((c) => {
      if (live && c) setCatalog(c);
    });
    return () => {
      live = false;
    };
  }, []);

  return useMemo(() => {
    if (!catalog) {
      return {
        ready: false,
        getTeam: seedTeamLookup,
        forumTeams: FORUM_ACTIVE_TEAM_IDS.map((id) => seedTeamLookup(id)!).filter(Boolean),
        leagueLabel: (id: string) => LEAGUE_LABEL[id as keyof typeof LEAGUE_LABEL] ?? id,
      };
    }
    const byId = new Map(catalog.teams.map((t) => [t.id, t]));
    const labels = new Map(catalog.leagues.map((l) => [l.id, l.name]));
    return {
      ready: true,
      getTeam: ((id: string) => byId.get(resolveTeamAlias(id))) as TeamLookup,
      forumTeams: catalog.teams.filter((t) => t.isForumActive),
      leagueLabel: (id: string) =>
        labels.get(id) ?? LEAGUE_LABEL[id as keyof typeof LEAGUE_LABEL] ?? id,
    };
  }, [catalog]);
}
