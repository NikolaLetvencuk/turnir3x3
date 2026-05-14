import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

type Team = { id: string; name: string; short_name: string | null };
type Match = {
  id: string;
  status: string;
  home_score: number;
  away_score: number;
  kickoff_at: string | null;
  home_team: Team | null;
  away_team: Team | null;
};

export function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  return (
    <Link
      href={`/matches/${match.id}`}
      className="block card hover:border-emerald-300 transition"
    >
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
        <span>{formatDateTime(match.kickoff_at)}</span>
        {isLive && <span className="badge-live"><span className="live-dot" />LIVE</span>}
        {isFinished && <span className="badge-finished">Završeno</span>}
        {!isLive && !isFinished && <span className="badge-scheduled">Zakazano</span>}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium truncate flex-1">{match.home_team?.name ?? "?"}</span>
        <span className="font-bold tabular-nums text-lg">
          {isLive || isFinished ? `${match.home_score} : ${match.away_score}` : "—"}
        </span>
        <span className="font-medium truncate flex-1 text-right">{match.away_team?.name ?? "?"}</span>
      </div>
    </Link>
  );
}
