"use client";

import { useEffect, useState } from "react";
import { useRealtimeMatch } from "@/lib/hooks/useRealtimeMatch";
import { TeamCrest } from "@/components/TeamCrest";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { formatKickoff } from "@/lib/utils";
import { getCurrentMinute, phaseLabel } from "@/lib/matchClock";
import type { Database } from "@/types/database";

type TeamMeta = { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null };

type Match = Database["public"]["Tables"]["matches"]["Row"] & {
  home_team: TeamMeta | null;
  away_team: TeamMeta | null;
  round?: { name: string; stage?: string } | null;
};
type MatchEvent = Database["public"]["Tables"]["match_events"]["Row"];
type PlayerLite = { id: string; name: string; team_id: string | null; photo_url: string | null };

type StandingRow = {
  team: TeamMeta;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

const eventIcon = (t: string) => {
  if (t === "goal") return "⚽";
  if (t === "own_goal") return "⚽(AG)";
  if (t === "yellow_card") return "🟨";
  if (t === "red_card") return "🟥";
  return "•";
};

function ClockDisplay({ match }: { match: Match }) {
  const [, setTick] = useState(0);
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
          <span className="live-dot" /> {minute}&apos;
          <span className="text-xs text-zinc-500 font-medium">{phaseLabel(match.phase)}</span>
        </div>
      )}
      {isHalftime && <div className="text-amber-600 font-bold tracking-wider">POLUVREME</div>}
      {isFinished && <div className="text-zinc-500 font-bold">ZAVRŠENO</div>}
      {isScheduled && <div className="text-zinc-500 text-sm">{formatKickoff(match.kickoff_at)}</div>}
    </div>
  );
}

function RosterCard({ team, players }: { team: TeamMeta | null; players: PlayerLite[] }) {
  if (!team) return null;
  const roster = players.filter((p) => p.team_id === team.id);
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <TeamCrest name={team.name} shortName={team.short_name} primaryColor={team.primary_color} secondaryColor={team.secondary_color} size={28} />
        <h3 className="font-semibold">{team.name}</h3>
        <span className="text-xs text-zinc-500 ml-auto">{roster.length} {roster.length === 1 ? "igrač" : "igrača"}</span>
      </div>
      {roster.length === 0 ? (
        <p className="text-sm text-zinc-500">Nema upisanih igrača.</p>
      ) : (
        <ul className="space-y-1">
          {roster.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <PlayerAvatar name={p.name} photoUrl={p.photo_url} teamPrimary={team.primary_color} size={28} />
              <span>{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupStandingsCard({ rows, homeTeamId, awayTeamId }: { rows: StandingRow[]; homeTeamId: string | null; awayTeamId: string | null }) {
  if (rows.length === 0) return null;
  return (
    <section className="card overflow-x-auto">
      <h3 className="font-semibold mb-2">Tabela grupe</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500">
            <th className="text-left py-1 w-6">#</th>
            <th className="text-left">Tim</th>
            <th className="text-right">O</th>
            <th className="text-right">P</th>
            <th className="text-right">N</th>
            <th className="text-right">I</th>
            <th className="text-right">GR</th>
            <th className="text-right">B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const highlight = r.team.id === homeTeamId || r.team.id === awayTeamId;
            return (
              <tr key={r.team.id} className={`border-t border-zinc-100 ${highlight ? "bg-emerald-50/50" : ""}`}>
                <td className="py-1 text-zinc-500">{i + 1}.</td>
                <td className={`py-1 ${highlight ? "font-semibold" : ""}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <TeamCrest name={r.team.name} shortName={r.team.short_name} primaryColor={r.team.primary_color} secondaryColor={r.team.secondary_color} size={18} />
                    {r.team.name}
                  </span>
                </td>
                <td className="text-right tabular-nums">{r.played}</td>
                <td className="text-right tabular-nums">{r.wins}</td>
                <td className="text-right tabular-nums">{r.draws}</td>
                <td className="text-right tabular-nums">{r.losses}</td>
                <td className="text-right tabular-nums">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</td>
                <td className="text-right tabular-nums font-semibold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function LiveMatchView({ matchInit, eventsInit, players, groupStandings }: {
  matchInit: Match;
  eventsInit: MatchEvent[];
  players: PlayerLite[];
  groupStandings: StandingRow[];
}) {
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
  const isPreMatch = !m.phase || m.phase === "scheduled";
  const hasStarted = m.phase === "first_half" || m.phase === "halftime" || m.phase === "second_half" || m.phase === "finished";

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
          <div className="text-center text-4xl font-bold tabular-nums">
            {hasStarted ? `${m.home_score} : ${m.away_score}` : <span className="text-zinc-400 text-2xl">vs</span>}
          </div>
          <div className="text-center">
            <TeamCrest name={m.away_team?.name ?? "?"} shortName={m.away_team?.short_name} primaryColor={m.away_team?.primary_color} secondaryColor={m.away_team?.secondary_color} size={56} className="mx-auto" />
            <div className="font-semibold mt-1">{m.away_team?.name}</div>
          </div>
        </div>
      </div>

      {isPreMatch ? (
        <>
          <GroupStandingsCard rows={groupStandings} homeTeamId={m.home_team_id} awayTeamId={m.away_team_id} />
          <section>
            <h2 className="font-semibold mb-2">Sastavi timova</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <RosterCard team={m.home_team} players={players} />
              <RosterCard team={m.away_team} players={players} />
            </div>
          </section>
        </>
      ) : (
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
      )}
    </div>
  );
}
