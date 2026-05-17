import Link from "next/link";
import { TeamCrest } from "@/components/TeamCrest";
import { formatDateTime } from "@/lib/utils";

type Team = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};
type Match = {
  id: string;
  status: string;
  phase?: string | null;
  home_score: number;
  away_score: number;
  kickoff_at: string | null;
  home_team: Team | null;
  away_team: Team | null;
};

export function MatchCard({ match }: { match: Match }) {
  const phase = match.phase ?? match.status;
  const isLive = phase === "first_half" || phase === "halftime" || phase === "second_half" || match.status === "live";
  const isFinished = phase === "finished" || match.status === "finished";
  return (
    <Link
      href={`/matches/${match.id}`}
      className="block card hover:border-emerald-300 transition"
    >
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2 gap-2">
        <span className="truncate">{formatDateTime(match.kickoff_at)}</span>
        {isLive && <span className="badge-live shrink-0"><span className="live-dot" />LIVE</span>}
        {isFinished && <span className="badge-finished shrink-0">Završeno</span>}
        {!isLive && !isFinished && <span className="badge-scheduled shrink-0">Zakazano</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0">
            <TeamCrest name={match.home_team?.name ?? "?"} shortName={match.home_team?.short_name} primaryColor={match.home_team?.primary_color} secondaryColor={match.home_team?.secondary_color} size={28} />
          </span>
          <span className="font-medium truncate">{match.home_team?.name ?? "?"}</span>
        </div>
        <span className="font-bold tabular-nums text-base sm:text-lg shrink-0">
          {isLive || isFinished ? `${match.home_score} : ${match.away_score}` : "—"}
        </span>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="font-medium truncate text-right">{match.away_team?.name ?? "?"}</span>
          <span className="shrink-0">
            <TeamCrest name={match.away_team?.name ?? "?"} shortName={match.away_team?.short_name} primaryColor={match.away_team?.primary_color} secondaryColor={match.away_team?.secondary_color} size={28} />
          </span>
        </div>
      </div>
    </Link>
  );
}
