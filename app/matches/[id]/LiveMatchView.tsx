"use client";

import { useRealtimeMatch } from "@/lib/hooks/useRealtimeMatch";
import { formatDateTime } from "@/lib/utils";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"] & {
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  round?: { name: string } | null;
};
type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];
type PlayerLite = { id: string; name: string; team_id: string | null };

const eventIcon = (t: string) => {
  if (t === "goal") return "⚽";
  if (t === "own_goal") return "⚽(AG)";
  if (t === "yellow_card") return "🟨";
  if (t === "red_card") return "🟥";
  return "•";
};

export function LiveMatchView({ matchInit, eventsInit, players }: { matchInit: Match; eventsInit: MatchEvent[]; players: PlayerLite[] }) {
  const { match, events } = useRealtimeMatch(matchInit.id, matchInit, eventsInit);
  const m = match as Match;
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamName = (id: string | null) => {
    if (id === m.home_team_id) return m.home_team?.name ?? "";
    if (id === m.away_team_id) return m.away_team?.name ?? "";
    return "";
  };
  const isLive = m.status === "live";

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
          <span>{m.round?.name ?? ""}</span>
          {isLive ? <span className="badge-live"><span className="live-dot" />UŽIVO</span> : <span>{formatDateTime(m.kickoff_at)}</span>}
        </div>
        <div className="grid grid-cols-3 items-center gap-4">
          <div className="text-center">
            <div className="font-semibold">{m.home_team?.name}</div>
          </div>
          <div className="text-center text-4xl font-bold tabular-nums">{m.home_score} : {m.away_score}</div>
          <div className="text-center">
            <div className="font-semibold">{m.away_team?.name}</div>
          </div>
        </div>
        {m.status === "scheduled" && <p className="text-center text-sm text-zinc-500 mt-3">Meč počinje {formatDateTime(m.kickoff_at)}</p>}
        {m.status === "finished" && <p className="text-center text-sm text-zinc-500 mt-3">Završeno</p>}
      </div>

      <section>
        <h2 className="font-semibold mb-2">Tok meča</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">Još nema događaja.</p>
        ) : (
          <ul className="card divide-y divide-zinc-100">
            {events.map((e) => {
              const p = playerMap.get(e.player_id);
              const assist = e.assist_player_id ? playerMap.get(e.assist_player_id) : null;
              return (
                <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                  <span className="text-xs text-zinc-500 w-10 tabular-nums">{e.minute != null ? `${e.minute}'` : "—"}</span>
                  <span className="text-lg">{eventIcon(e.event_type)}</span>
                  <div className="flex-1">
                    <div className="font-medium">{p?.name ?? "?"}</div>
                    <div className="text-xs text-zinc-500">
                      {teamName(e.team_id)}
                      {assist ? ` · asistencija: ${assist.name}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
