import { teamBadge, type Team } from "@/lib/teams";

export default function TeamMark({
  team,
  size = 44,
}: {
  team: Team;
  size?: number;
}) {
  const badge = teamBadge(team);
  return (
    <span
      className="inline-flex flex-col border-[3px] border-black overflow-hidden shrink-0 shadow-[3px_3px_0_black]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="flex-1 grid place-items-center font-anton leading-none"
        style={{
          background: badge.bg,
          color: badge.fg,
          fontSize: Math.round(size * 0.3),
        }}
      >
        {team.short.slice(0, 3)}
      </span>
      <span className="flex h-[7px]">
        <span className="w-1/2 h-full" style={{ background: badge.bar[0] }} />
        <span className="w-1/2 h-full" style={{ background: badge.bar[1] }} />
      </span>
    </span>
  );
}
