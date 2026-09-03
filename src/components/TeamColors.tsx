import type { Team } from "@/lib/teams";

export default function TeamColors({
  team,
  size = 14,
}: {
  team: Pick<Team, "bleed" | "accent">;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 border-[2px] border-black overflow-hidden"
      style={{ width: size * 2, height: size }}
      aria-hidden
    >
      <span className="h-full w-1/2" style={{ background: team.bleed }} />
      <span className="h-full w-1/2" style={{ background: team.accent }} />
    </span>
  );
}
