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
  return pos.replace("_", " ");
}

function Slot({
  team,
  placeholder,
  manual,
  onClick,
}: {
  team: TeamLite | null;
  placeholder: string | null;
  manual: boolean;
  onClick?: () => void;
}) {
  if (team) {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-zinc-800 disabled:hover:bg-transparent"
      >
        <TeamCrest
          name={team.name}
          shortName={team.short_name}
          primaryColor={team.primary_color}
          secondaryColor={team.secondary_color}
          size={20}
        />
        <span className="text-sm truncate">{team.name}</span>
        {manual && <span className="text-[10px] text-blue-300 ml-auto">M</span>}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-2 w-full text-left py-1 px-2 rounded hover:bg-zinc-800 disabled:hover:bg-transparent text-zinc-400 italic text-sm"
    >
      {placeholder ?? "—"}
    </button>
  );
}

function MatchCard({
  m,
  teamMap,
  onSlotClick,
}: {
  m: BracketMatchView;
  teamMap: Map<string, TeamLite>;
  onSlotClick?: (match_id: string, slot: "home" | "away", currentTeamId: string | null) => void;
}) {
  const hTeam = m.home_team_id ? teamMap.get(m.home_team_id) ?? m.home_team : m.home_team;
  const aTeam = m.away_team_id ? teamMap.get(m.away_team_id) ?? m.away_team : m.away_team;
  const winnerId =
    m.knockout_winner_id ??
    (m.phase === "finished"
      ? m.home_score! > m.away_score!
        ? m.home_team_id
        : m.away_score! > m.home_score!
        ? m.away_team_id
        : null
      : null);
  return (
    <div className="card !p-2">
      <div className="text-[10px] text-zinc-500 mb-1 flex justify-between">
        <span>{prettyBracketPosition(m.bracket_position)}</span>
        {m.phase === "finished" && <span>FT</span>}
        {(m.phase === "first_half" || m.phase === "halftime" || m.phase === "second_half") && (
          <span className="text-red-400">UŽIVO</span>
        )}
      </div>
      <div className={winnerId && hTeam?.id === winnerId ? "font-semibold" : ""}>
        <Slot
          team={hTeam ?? null}
          placeholder={m.home_placeholder}
          manual={!!m.home_team_id_manual}
          onClick={onSlotClick ? () => onSlotClick(m.id, "home", m.home_team_id) : undefined}
        />
      </div>
      <div className="text-center text-xs tabular-nums text-zinc-500 my-0.5">
        {m.phase === "finished" || m.phase === "first_half" || m.phase === "halftime" || m.phase === "second_half"
          ? `${m.home_score ?? 0} : ${m.away_score ?? 0}`
          : <span className="text-zinc-400">vs</span>}
      </div>
      <div className={winnerId && aTeam?.id === winnerId ? "font-semibold" : ""}>
        <Slot
          team={aTeam ?? null}
          placeholder={m.away_placeholder}
          manual={!!m.away_team_id_manual}
          onClick={onSlotClick ? () => onSlotClick(m.id, "away", m.away_team_id) : undefined}
        />
      </div>
      <Link href={`/admin/matches/${m.id}/live`} className="block text-[10px] text-blue-300 mt-1 hover:underline">
        otvori →
      </Link>
    </div>
  );
}

// Color used for the connector lines between matches.
const LINE = "rgba(212,175,55,0.45)";

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

  // Split matches by round, and pull out the 3rd-place match — it shares the
  // final's round but isn't part of the elimination flow, so we render it on
  // the side without connector lines.
  const byRound = new Map<string, BracketMatchView[]>();
  const thirdPlace: BracketMatchView[] = [];
  for (const m of matches) {
    if (m.bracket_position === "TP") {
      thirdPlace.push(m);
      continue;
    }
    const arr = byRound.get(m.round_id) ?? [];
    arr.push(m);
    byRound.set(m.round_id, arr);
  }

  // Vertical layout: matches in each column use justify-around so their
  // midpoints line up across rounds. Stretching every column to the same
  // height keeps the bracket math automatic regardless of how many matches
  // the first round has.
  const firstRoundCount = (byRound.get(rounds[0]?.id) ?? []).length;
  const minColHeight = Math.max(280, firstRoundCount * 96);

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex gap-8 min-w-fit items-stretch">
        {rounds.map((r, roundIdx) => {
          const isFirst = roundIdx === 0;
          const isLast = roundIdx === rounds.length - 1;
          const list = byRound.get(r.id) ?? [];
          return (
            <div key={r.id} className="w-60 shrink-0 flex flex-col">
              <h3 className="font-medium text-sm text-zinc-300 mb-2 text-center">{r.name}</h3>
              <div
                className="flex flex-col justify-around"
                style={{ minHeight: `${minColHeight}px` }}
              >
                {list.map((m, i) => {
                  // For even pairs in non-first rounds, the connector going out
                  // to the right needs to drop down to meet its sibling; for
                  // odd ones it goes up. We draw that with absolute lines.
                  const isPairTop = i % 2 === 0;
                  const isPairBottom = i % 2 === 1;
                  return (
                    <div key={m.id} className="relative">
                      {/* Incoming line from previous round (left stub) */}
                      {!isFirst && (
                        <span
                          aria-hidden
                          className="absolute -left-4 top-1/2 w-4 h-px"
                          style={{ background: LINE }}
                        />
                      )}
                      {/* Outgoing line to next round (right horizontal stub) */}
                      {!isLast && (
                        <span
                          aria-hidden
                          className="absolute -right-4 top-1/2 w-4 h-px"
                          style={{ background: LINE }}
                        />
                      )}
                      {/* Vertical bracket connector joining each pair to the
                           midpoint between them on the right side */}
                      {!isLast && isPairTop && list[i + 1] && (
                        <span
                          aria-hidden
                          className="absolute -right-4 top-1/2 w-px"
                          style={{ background: LINE, height: "calc(100% + 1rem)" }}
                        />
                      )}
                      {!isLast && isPairBottom && (
                        <span
                          aria-hidden
                          className="absolute -right-4 bottom-1/2 w-px"
                          style={{ background: LINE, height: "calc(100% + 1rem)" }}
                        />
                      )}
                      <MatchCard m={m} teamMap={teamMap} onSlotClick={onSlotClick} />
                    </div>
                  );
                })}
              </div>
              {/* 3rd-place match rendered under the final column */}
              {isLast && thirdPlace.length > 0 && (
                <div className="mt-6 pt-4 border-t border-dashed border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 text-center">
                    Utakmica za 3. mesto
                  </div>
                  {thirdPlace.map((m) => (
                    <MatchCard key={m.id} m={m} teamMap={teamMap} onSlotClick={onSlotClick} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
