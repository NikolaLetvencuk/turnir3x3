"use client";

import { useEffect, useState } from "react";
import { Lock, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PitchTeam, type PitchPlayerSlot } from "@/components/fantasy/PitchTeam";

type RoundLite = { id: string; name: string; status: string; display_order: number };
type SnapRow = {
  round_id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  transfer_penalty: number;
};
type PlayerLite = { id: string; name: string; photo_url: string | null; team_id: string | null };
type PpRow = {
  player_id: string;
  round_id: string;
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  total_points: number;
};
type FrpRow = { round_id: string; total_points: number };
type TeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};
type MatchLite = { round_id: string; home_team_id: string | null; away_team_id: string | null; status: string };

export function MemberHistory({
  userId, displayName, isMe, onClose,
}: {
  userId: string;
  displayName: string;
  isMe: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<RoundLite[]>([]);
  const [snaps, setSnaps] = useState<SnapRow[]>([]);
  const [playerMap, setPlayerMap] = useState<Map<string, PlayerLite>>(new Map());
  const [teamMap, setTeamMap] = useState<Map<string, TeamLite>>(new Map());
  const [ppByKey, setPpByKey] = useState<Map<string, PpRow>>(new Map());
  const [frpMap, setFrpMap] = useState<Map<string, number>>(new Map());
  const [matchesByTeamRound, setMatchesByTeamRound] = useState<Map<string, MatchLite[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [roundsRes, snapRes, playersRes, teamsRes, ppRes, frpRes, matchesRes] = await Promise.all([
        supabase.from("rounds").select("id, name, status, display_order").order("display_order"),
        supabase.from("fantasy_team_snapshots").select("round_id, player1_id, player2_id, player3_id, transfer_penalty").eq("user_id", userId),
        supabase.from("players").select("id, name, photo_url, team_id"),
        supabase.from("teams").select("id, name, short_name, primary_color, secondary_color"),
        supabase.from("fantasy_player_points").select("player_id, round_id, goals, assists, wins, draws, losses, clean_sheets, yellow_cards, red_cards, own_goals, total_points"),
        supabase.from("fantasy_round_points").select("round_id, total_points").eq("user_id", userId),
        supabase.from("matches").select("round_id, home_team_id, away_team_id, status"),
      ]);
      if (cancelled) return;
      setRounds((roundsRes.data ?? []) as RoundLite[]);
      setSnaps((snapRes.data ?? []) as SnapRow[]);
      const players = (playersRes.data ?? []) as PlayerLite[];
      setPlayerMap(new Map(players.map((p) => [p.id, p])));
      const teams = (teamsRes.data ?? []) as TeamLite[];
      setTeamMap(new Map(teams.map((t) => [t.id, t])));
      const pp = new Map<string, PpRow>();
      for (const r of ((ppRes.data ?? []) as PpRow[])) pp.set(`${r.player_id}_${r.round_id}`, r);
      setPpByKey(pp);
      const frp = new Map<string, number>();
      for (const r of ((frpRes.data ?? []) as FrpRow[])) frp.set(r.round_id, r.total_points);
      setFrpMap(frp);
      const matchMap = new Map<string, MatchLite[]>();
      for (const m of ((matchesRes.data ?? []) as MatchLite[])) {
        if (m.home_team_id) {
          const k = `${m.home_team_id}_${m.round_id}`;
          const arr = matchMap.get(k) ?? [];
          arr.push(m);
          matchMap.set(k, arr);
        }
        if (m.away_team_id) {
          const k = `${m.away_team_id}_${m.round_id}`;
          const arr = matchMap.get(k) ?? [];
          arr.push(m);
          matchMap.set(k, arr);
        }
      }
      setMatchesByTeamRound(matchMap);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function slotFor(playerId: string | null, roundId: string): PitchPlayerSlot {
    if (!playerId) return null;
    const p = playerMap.get(playerId);
    const team = p?.team_id ? teamMap.get(p.team_id) : null;
    const pp = ppByKey.get(`${playerId}_${roundId}`);
    const teamMatches = p?.team_id ? matchesByTeamRound.get(`${p.team_id}_${roundId}`) ?? [] : [];
    const yetToPlay = teamMatches.length > 0 && teamMatches.some((m) => m.status !== "finished");
    return {
      id: playerId,
      name: p?.name ?? "?",
      team_name: team?.name ?? null,
      team_short: team?.short_name ?? null,
      team_primary: team?.primary_color ?? null,
      team_secondary: team?.secondary_color ?? null,
      points: pp?.total_points ?? 0,
      breakdown: pp
        ? {
            goals: pp.goals,
            assists: pp.assists,
            wins: pp.wins,
            draws: pp.draws,
            losses: pp.losses ?? 0,
            clean_sheets: pp.clean_sheets,
            yellow_cards: pp.yellow_cards,
            red_cards: pp.red_cards,
            own_goals: pp.own_goals,
          }
        : null,
      yet_to_play: yetToPlay,
    };
  }

  const snapByRound = new Map(snaps.map((s) => [s.round_id, s]));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold truncate">{displayName} {isMe && <span className="text-xs text-blue-700">(ti)</span>}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none" aria-label="Zatvori">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Učitavam…</p>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => {
              const snap = snapByRound.get(r.id);
              const isUpcoming = r.status === "upcoming";
              const canShow = !isUpcoming || isMe;
              const total = frpMap.get(r.id);
              return (
                <div key={r.id} className="card !p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {r.name}
                      <span className="text-[10px] text-zinc-400">{r.status}</span>
                    </div>
                    <div className="text-right">
                      {total != null ? (
                        <div className="font-bold tabular-nums">{total}</div>
                      ) : (
                        <div className="text-xs text-zinc-400">—</div>
                      )}
                    </div>
                  </div>
                  {!snap ? (
                    <p className="text-xs text-zinc-400 italic">Bez tima u ovom kolu.</p>
                  ) : !canShow ? (
                    <div className="text-xs text-zinc-500 inline-flex items-center gap-1">
                      <EyeOff className="w-3.5 h-3.5" /> Tim sakriven dok kolo ne počne
                    </div>
                  ) : (
                    <>
                      <PitchTeam
                        slots={[
                          slotFor(snap.player1_id, r.id),
                          slotFor(snap.player2_id, r.id),
                          slotFor(snap.player3_id, r.id),
                        ]}
                        size="sm"
                        showHint={false}
                      />
                      {isUpcoming && isMe && (
                        <div className="text-[10px] text-blue-700 inline-flex items-center gap-1 mt-2">
                          <Lock className="w-3 h-3" /> Tvoj lockovani tim (sakriven za ostale)
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
