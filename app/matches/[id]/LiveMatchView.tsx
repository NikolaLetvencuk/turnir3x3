"use client";

import { useEffect, useState } from "react";
import { useRealtimeMatch } from "@/lib/hooks/useRealtimeMatch";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatDateTime } from "@/lib/utils";
import { getCurrentMinute, phaseLabel } from "@/lib/matchClock";
import type { Database } from "@/types/database";

type Match = Database["public"]["Tables"]["matches"]["Row"] & {
  home_team: { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  away_team: { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  round?: { name: string } | null;
};
type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];
type PlayerLite = { id: string; name: string; team_id: string | null; photo_url: string | null };

const eventIcon = (t: string) => {
  if (t === "goal") return "⚽";
  if (t === "own_goal") return "⚽(AG)";
  if (t === "yellow_card") return "🟨";
  if (t === "red_card") return "🟥";
  return "•";
};

function ClockDisplay({ match }: { match: Match }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (match.phase === "first_half" || match.phase === "second_half") {
      const id = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(id);
    }
  }, [match.phase]);
  const minute = getCurrentMinute(match as any);
  const isLive = match.phase === "first_half" || match.phase === "second_half";
  const isHalftime = match.phase === "halftime";
  const isFinished = match.phase === "finished";
  const isScheduled = !match.phase || match.phase === "scheduled";

  return (
    <div className="text-center">
      {isLive && (
        <div className="inline-flex items-center gap-2 text-red-600 font-bold text-xl animate-pulse">
          <span className="live-dot" /> {minute}'
          <span className="text-xs text-zinc-500 font-medium">{phaseLabel(match.phase)}</span>
        </div>
      )}
      {isHalftime && <div className="text-amber-600 font-bold tracking-wider">POLUVREME</div>}
      {isFinished && <div className="text-zinc-500 font-bold">ZAVRŠENO</div>}
      {isScheduled && <div className="text-zinc-500 text-sm">{formatDateTime(match.kickoff_at)}</div>}
    </div>
  );
}

export function LiveMatchView({ matchInit, eventsInit, players }: { matchInit: Match; eventsInit: MatchEvent[]; players: PlayerLite[] }) {
  const { match, events } = useRealtimeMatch(matchInit.id, matchInit, eventsInit);
  const m = match as Match;
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamName = (id: string | null) => {
    if (id === m.home_team_id) return m.home_team?.name ?? "";
    if (id === m.away_team_id) return m.away_team?.name ?? "";
    return "";
  };
  const teamPrimary = (id: string | null) => {
    if (id === m.home_team_id) return m.home_team?.primary_color ?? null;
    if (id === m.away_team_id) return m.away_team?.primary_color ?? null;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>{m.round?.name ?? ""}</span>
        </div>
        <ClockDisplay match={m} />
        <div className="mt-3 grid grid-cols-3 items-center gap-4">
          <div className="text-center">
            <TeamCrest name={m.home_team?.name ?? "?"} shortName={m.home_team?.short_name} primaryColor={m.home_team?.primary_color} secondaryColor={m.home_team?.secondary_color} size={56} className="mx-auto" />
            <div className="font-semibold mt-1">{m.home_team?.name}</div>
          </div>
          <div className="text-center text-4xl font-bold tabular-nums">{m.home_score} : {m.away_score}</div>
          <div className="text-center">
            <TeamCrest name={m.away_team?.name ?? "?"} shortName={m.away_team?.short_name} primaryColor={m.away_team?.primary_color} secondaryColor={m.away_team?.secondary_color} size={56} className="mx-auto" />
            <div className="font-semibold mt-1">{m.away_team?.name}</div>
          </div>
        </div>
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
                  <PlayerAvatar name={p?.name ?? "?"} photoUrl={p?.photo_url ?? null} teamPrimary={teamPrimary(e.team_id)} size={28} />
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
