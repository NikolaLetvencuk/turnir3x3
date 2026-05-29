"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";

type PlayerLite = { id: string; name: string; photo_url: string | null; team_id: string | null };
type PickRow = { day: string; player1_id: string; player2_id: string; player3_id: string };
type PointRow = {
  day: string;
  player1_points: number;
  player2_points: number;
  player3_points: number;
  total_points: number;
};

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}

export function MemberHistory({
  userId,
  displayName,
  isMe,
  onClose,
}: {
  userId: string;
  displayName: string;
  isMe: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [pointsByDay, setPointsByDay] = useState<Map<string, PointRow>>(new Map());
  const [playerMap, setPlayerMap] = useState<Map<string, PlayerLite>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [picksRes, pointsRes, playersRes] = await Promise.all([
        (supabase as any)
          .from("fantasy_day_picks")
          .select("day, player1_id, player2_id, player3_id")
          .eq("user_id", userId)
          .order("day", { ascending: false }),
        (supabase as any)
          .from("fantasy_day_points")
          .select("day, player1_points, player2_points, player3_points, total_points")
          .eq("user_id", userId),
        supabase.from("players").select("id, name, photo_url, team_id, team:teams(primary_color)"),
      ]);
      if (cancelled) return;
      setPicks((picksRes.data ?? []) as PickRow[]);
      const pm = new Map<string, PointRow>();
      for (const r of (pointsRes.data ?? []) as PointRow[]) pm.set(r.day, r);
      setPointsByDay(pm);
      const players = ((playersRes.data ?? []) as any[]).map((p) => ({
        id: p.id,
        name: p.name,
        photo_url: p.photo_url,
        team_id: p.team_id,
        team_primary: p.team?.primary_color ?? null,
      }));
      setPlayerMap(new Map(players.map((p) => [p.id, p as any])));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold truncate">
            {displayName} {isMe && <span className="text-xs text-blue-300">(ti)</span>}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-300 text-xl leading-none" aria-label="Zatvori">
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Učitavam…</p>
        ) : picks.length === 0 ? (
          <p className="text-sm text-zinc-500">Još nema sastavljenih timova.</p>
        ) : (
          <div className="space-y-3">
            {picks.map((pk) => {
              const pts = pointsByDay.get(pk.day);
              const slots = [
                { id: pk.player1_id, pts: pts?.player1_points ?? 0 },
                { id: pk.player2_id, pts: pts?.player2_points ?? 0 },
                { id: pk.player3_id, pts: pts?.player3_points ?? 0 },
              ];
              return (
                <div key={pk.day} className="card !p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm">{formatSrDate(pk.day)}</div>
                    <div className="font-bold tabular-nums">{pts?.total_points ?? 0}</div>
                  </div>
                  <ul className="space-y-1.5">
                    {slots.map((s, i) => {
                      const p = playerMap.get(s.id) as any;
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <PlayerAvatar
                            name={p?.name ?? "?"}
                            photoUrl={p?.photo_url ?? null}
                            teamPrimary={p?.team_primary ?? null}
                            size={24}
                          />
                          <span className="flex-1 truncate">{p?.name ?? "?"}</span>
                          <span
                            className={`tabular-nums font-semibold w-8 text-right ${
                              s.pts > 0 ? "text-emerald-300" : s.pts < 0 ? "text-red-300" : "text-zinc-400"
                            }`}
                          >
                            {s.pts > 0 ? `+${s.pts}` : s.pts}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
