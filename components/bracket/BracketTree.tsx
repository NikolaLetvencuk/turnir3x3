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

// Gold-tinted connector color matching the brand accent.
const LINE = "rgba(212,175,55,0.45)";

type Side = "left" | "right" | "center";

function BracketColumn({
  title,
  matches,
  teamMap,
  minHeight,
  side,
  isOutermost,
  onSlotClick,
}: {
  title: string;
  matches: BracketMatchView[];
  teamMap: Map<string, TeamLite>;
  minHeight: number;
  side: Side;
  /** True for the column that holds the very first round on this side (no
   *  incoming connectors needed). */
  isOutermost: boolean;
  onSlotClick?: (match_id: string, slot: "home" | "away", currentTeamId: string | null) => void;
}) {
  // Left side: outgoing line points right (matches travel toward center).
  // Right side: outgoing line points left.
  // Center column (the final): receives lines on both sides.
  const outgoingDir: "right" | "left" | "both" =
    side === "left" ? "right" : side === "right" ? "left" : "both";
  const incomingDir: "right" | "left" | "none" =
    side === "left" ? "left" : side === "right" ? "right" : "none";

  return (
    <div className="w-56 shrink-0 flex flex-col">
      <h3 className="font-medium text-sm text-zinc-300 mb-2 text-center">{title}</h3>
      <div className="flex flex-col justify-around" style={{ minHeight: `${minHeight}px` }}>
        {matches.map((m, i) => {
          const isPairTop = i % 2 === 0;
          const hasPairBelow = i + 1 < matches.length;
          // Vertical connector goes on the side opposite to the previous round
          // (matches travel toward center): right side for left columns, left
          // side for right columns. Center column doesn't pair-connect.
          const showVerticalTop = side !== "center" && outgoingDir !== "both" && isPairTop && hasPairBelow;
          const showVerticalBottom = side !== "center" && outgoingDir !== "both" && !isPairTop;
          return (
            <div key={m.id} className="relative">
              {/* Incoming horizontal stub (from previous outer round) */}
              {!isOutermost && incomingDir !== "none" && (
                <span
                  aria-hidden
                  className={`absolute top-1/2 w-4 h-px ${incomingDir === "left" ? "-left-4" : "-right-4"}`}
                  style={{ background: LINE }}
                />
              )}
              {/* Outgoing horizontal stub (toward next inner round / center) */}
              {outgoingDir !== "both" && (
                <span
                  aria-hidden
                  className={`absolute top-1/2 w-4 h-px ${outgoingDir === "right" ? "-right-4" : "-left-4"}`}
                  style={{ background: LINE }}
                />
              )}
              {/* Center column has stubs on both sides (the final) */}
              {outgoingDir === "both" && (
                <>
                  <span aria-hidden className="absolute top-1/2 -left-4 w-4 h-px" style={{ background: LINE }} />
                  <span aria-hidden className="absolute top-1/2 -right-4 w-4 h-px" style={{ background: LINE }} />
                </>
              )}
              {/* Vertical connector joining a pair to their midpoint */}
              {showVerticalTop && (
                <span
                  aria-hidden
                  className={`absolute top-1/2 w-px ${outgoingDir === "right" ? "-right-4" : "-left-4"}`}
                  style={{ background: LINE, height: "calc(100% + 1rem)" }}
                />
              )}
              {showVerticalBottom && (
                <span
                  aria-hidden
                  className={`absolute bottom-1/2 w-px ${outgoingDir === "right" ? "-right-4" : "-left-4"}`}
                  style={{ background: LINE, height: "calc(100% + 1rem)" }}
                />
              )}
              <MatchCard m={m} teamMap={teamMap} onSlotClick={onSlotClick} />
            </div>
          );
        })}
      </div>
    </div>
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

  // Group matches by round, peeling off the 3rd-place playoff which renders
  // under the final column without connectors.
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

  // Sort each round's matches by bracket_position so R16_1..R16_8 land in
  // order. This is the same order pairBracketSlots produces.
  for (const list of byRound.values()) {
    list.sort((a, b) => {
      const ap = a.bracket_position ?? "";
      const bp = b.bracket_position ?? "";
      // Compare numeric suffix when prefixes match (R16_1 < R16_10)
      const aMatch = ap.match(/^(.+?)_(\d+)$/);
      const bMatch = bp.match(/^(.+?)_(\d+)$/);
      if (aMatch && bMatch && aMatch[1] === bMatch[1]) {
        return parseInt(aMatch[2], 10) - parseInt(bMatch[2], 10);
      }
      return ap.localeCompare(bp);
    });
  }

  const finalRound = rounds[rounds.length - 1];
  const nonFinalRounds = rounds.slice(0, -1);
  const finalMatches = (byRound.get(finalRound?.id ?? "") ?? []);

  // Split each non-final round into left/right halves.
  const sides = nonFinalRounds.map((r) => {
    const list = byRound.get(r.id) ?? [];
    const half = Math.ceil(list.length / 2);
    return { round: r, left: list.slice(0, half), right: list.slice(half) };
  });

  // Column height is driven by the outermost round (most matches).
  const firstRoundCount = sides[0]?.left.length ?? 0;
  const minColHeight = Math.max(280, firstRoundCount * 2 * 96);

  // If only a final exists, render just the center column.
  if (sides.length === 0) {
    return (
      <div className="overflow-x-auto py-2">
        <div className="flex justify-center min-w-fit">
          <div className="w-56 shrink-0 flex flex-col">
            <h3 className="font-medium text-sm text-zinc-300 mb-2 text-center">{finalRound.name}</h3>
            <div className="flex flex-col justify-around" style={{ minHeight: "240px" }}>
              {finalMatches.map((m) => (
                <MatchCard key={m.id} m={m} teamMap={teamMap} onSlotClick={onSlotClick} />
              ))}
            </div>
            {thirdPlace.length > 0 && (
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
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex gap-8 min-w-fit items-stretch justify-center">
        {/* Left half: outermost round on the left, innermost just before center */}
        {sides.map((s, idx) => (
          <BracketColumn
            key={`L-${s.round.id}`}
            title={s.round.name}
            matches={s.left}
            teamMap={teamMap}
            minHeight={minColHeight}
            side="left"
            isOutermost={idx === 0}
            onSlotClick={onSlotClick}
          />
        ))}

        {/* Center: final + 3rd place playoff */}
        <div className="w-56 shrink-0 flex flex-col">
          <h3 className="font-medium text-sm text-zinc-300 mb-2 text-center">{finalRound.name}</h3>
          <div className="flex flex-col justify-around" style={{ minHeight: `${minColHeight}px` }}>
            {finalMatches.map((m) => (
              <div key={m.id} className="relative">
                <span aria-hidden className="absolute top-1/2 -left-4 w-4 h-px" style={{ background: LINE }} />
                <span aria-hidden className="absolute top-1/2 -right-4 w-4 h-px" style={{ background: LINE }} />
                <MatchCard m={m} teamMap={teamMap} onSlotClick={onSlotClick} />
              </div>
            ))}
          </div>
          {thirdPlace.length > 0 && (
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

        {/* Right half: mirror of left — innermost round next to center,
            outermost at far right. */}
        {sides
          .slice()
          .reverse()
          .map((s, idx) => (
            <BracketColumn
              key={`R-${s.round.id}`}
              title={s.round.name}
              matches={s.right}
              teamMap={teamMap}
              minHeight={minColHeight}
              side="right"
              isOutermost={idx === sides.length - 1}
              onSlotClick={onSlotClick}
            />
          ))}
      </div>
    </div>
  );
}
