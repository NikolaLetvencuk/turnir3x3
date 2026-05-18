"use client";

import { useEffect, useState } from "react";
import { Lock, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";

type RoundLite = { id: string; name: string; status: string; display_order: number };
type SnapRow = {
  round_id: string;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  transfer_penalty: number;
};
type PlayerLite = { id: string; name: string; photo_url: string | null; team_id: string | null };
type PpRow = { player_id: string; round_id: string; goals: number; assists: number; yellow_cards: number; red_cards: number; total_points: number };
type FrpRow = { round_id: string; total_points: number };
type TeamLite = { id: string; primary_color: string | null };

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [roundsRes, snapRes, playersRes, teamsRes, ppRes, frpRes] = await Promise.all([
        supabase.from("rounds").select("id, name, status, display_order").order("display_order"),
        supabase.from("fantasy_team_snapshots").select("round_id, player1_id, player2_id, player3_id, transfer_penalty").eq("user_id", userId),
        supabase.from("players").select("id, name, photo_url, team_id"),
        supabase.from("teams").select("id, primary_color"),
        supabase.from("fantasy_player_points").select("player_id, round_id, goals, assists, yellow_cards, red_cards, total_points"),
        supabase.from("fantasy_round_points").select("round_id, total_points").eq("user_id", userId),
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
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

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
              const canShow = !isUpcoming || isMe; // hide upcoming locks of other users
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
                    <div className="space-y-1 text-sm">
                      {([snap.player1_id, snap.player2_id, snap.player3_id] as (string | null)[]).map((pid, i) => {
                        if (!pid) return <div key={i} className="text-zinc-400 italic text-xs">— slot {i + 1} prazan</div>;
                        const p = playerMap.get(pid);
                        const pp = ppByKey.get(`${pid}_${r.id}`);
                        const primary = p?.team_id ? teamMap.get(p.team_id)?.primary_color ?? null : null;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <PlayerAvatar name={p?.name ?? "?"} photoUrl={p?.photo_url ?? null} teamPrimary={primary} size={28} />
                            <span className="flex-1 min-w-0 truncate">{p?.name ?? "?"}</span>
                            {pp && (
                              <span className="text-[10px] text-zinc-500 shrink-0">
                                {pp.goals}G {pp.assists}A {pp.yellow_cards ? `${pp.yellow_cards}🟨` : ""} {pp.red_cards ? `${pp.red_cards}🟥` : ""}
                              </span>
                            )}
                            {pp && <span className="font-bold tabular-nums w-8 text-right">{pp.total_points}</span>}
                          </div>
                        );
                      })}
                      {isUpcoming && isMe && (
                        <div className="text-[10px] text-blue-700 inline-flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Tvoj lockovani tim (sakriven za ostale)
                        </div>
                      )}
                    </div>
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
