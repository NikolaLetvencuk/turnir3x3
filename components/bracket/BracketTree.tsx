"use client";

import Link from "next/link";
import { TeamCrest } from "@/components/TeamCrest";

export type TeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type BracketMatchView = {
  id: string;
  round_id: string;
  bracket_position: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_team_id_manual: string | null;
  away_team_id_manual: string | null;
  home_score: number | null;
  away_score: number | null;
  phase: string | null;
  kickoff_at: string | null;
  knockout_winner_id: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
};

function prettyBracketPosition(pos: string | null): string {
  if (!pos) return "";
  if (pos === "F") return "Finale";
  if (pos === "TP") return "3. mesto";
  // SF_1 / QF_2 / R16_3 → "SF 1" etc.
  return pos.replace("_", " ");
}

function Slot({ team, placeholder, manual, onClick }: { team: TeamLite | null; placeholder: string | null; manual: boolean; onClick?: () => void }) {
  if (team) {
    return (
      <button onClick={onClick} disabled={!onClick} className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-zinc-800 disabled:hover:bg-transparent">
        <TeamCrest name={team.name} shortName={team.short_name} primaryColor={team.primary_color} secondaryColor={team.secondary_color} size={20} />
        <span className="text-sm truncate">{team.name}</span>
        {manual && <span className="text-[10px] text-blue-600 ml-auto">M</span>}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={!onClick} className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-zinc-800 disabled:hover:bg-transparent text-zinc-400 italic text-sm">
      {placeholder ?? "—"}
    </button>
  );
}

export function BracketTree({
  rounds,
  matches,
  teams,
  onSlotClick,
}: {
  rounds: Array<{ id: string; name: string; display_order: number }>;
  matches: BracketMatchView[];
  teams: TeamLite[];
  onSlotClick?: (match_id: string, slot: "home" | "away", currentTeamId: string | null) => void;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const byRound = new Map<string, BracketMatchView[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round_id) ?? [];
    arr.push(m);
    byRound.set(m.round_id, arr);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-fit">
        {rounds.map((r) => (
          <div key={r.id} className="w-60 shrink-0 space-y-2">
            <h3 className="font-medium text-sm text-zinc-300">{r.name}</h3>
            {(byRound.get(r.id) ?? []).map((m) => {
              const hTeam = m.home_team_id ? teamMap.get(m.home_team_id) ?? m.home_team : m.home_team;
              const aTeam = m.away_team_id ? teamMap.get(m.away_team_id) ?? m.away_team : m.away_team;
              const winnerId = m.knockout_winner_id ?? (
                m.phase === "finished"
                  ? (m.home_score! > m.away_score! ? m.home_team_id : m.away_score! > m.home_score! ? m.away_team_id : null)
                  : null
              );
              return (
                <div key={m.id} className="card !p-2">
                  <div className="text-[10px] text-zinc-500 mb-1 flex justify-between">
                    <span>{prettyBracketPosition(m.bracket_position)}</span>
                    {m.phase === "finished" && <span>FT</span>}
                    {m.phase === "first_half" || m.phase === "halftime" || m.phase === "second_half" ? <span className="text-red-600">UŽIVO</span> : null}
                  </div>
                  <div className={`${winnerId && hTeam?.id === winnerId ? "font-semibold" : ""}`}>
                    <Slot team={hTeam ?? null} placeholder={m.home_placeholder} manual={!!m.home_team_id_manual} onClick={onSlotClick ? () => onSlotClick(m.id, "home", m.home_team_id) : undefined} />
                  </div>
                  <div className="text-center text-xs tabular-nums text-zinc-500 my-0.5">
                    {m.phase === "finished" || m.phase === "first_half" || m.phase === "halftime" || m.phase === "second_half"
                      ? `${m.home_score ?? 0} : ${m.away_score ?? 0}`
                      : <span className="text-zinc-400">vs</span>}
                  </div>
                  <div className={`${winnerId && aTeam?.id === winnerId ? "font-semibold" : ""}`}>
                    <Slot team={aTeam ?? null} placeholder={m.away_placeholder} manual={!!m.away_team_id_manual} onClick={onSlotClick ? () => onSlotClick(m.id, "away", m.away_team_id) : undefined} />
                  </div>
                  <Link href={`/admin/matches/${m.id}/live`} className="block text-[10px] text-blue-700 mt-1 hover:underline">otvori →</Link>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
