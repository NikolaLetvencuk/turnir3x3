import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export const revalidate = 0;

export default async function HistoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team/history");
  const supabase = createClient();

  const [{ data: snapshots }, { data: roundPoints }, { data: players }, { data: playerPoints }, { data: rounds }] = await Promise.all([
    supabase.from("fantasy_team_snapshots").select("*").eq("user_id", profile.id),
    supabase.from("fantasy_round_points").select("*").eq("user_id", profile.id),
    supabase.from("players").select("id, name"),
    supabase.from("fantasy_player_points").select("*"),
    supabase.from("rounds").select("id, name, display_order, status").order("display_order"),
  ]);

  const playerMap = new Map(((players ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
  const ppMap = new Map<string, any>();
  for (const p of (playerPoints ?? []) as any[]) ppMap.set(`${p.player_id}_${p.round_id}`, p);
  const snapMap = new Map<string, any>();
  for (const s of (snapshots ?? []) as any[]) snapMap.set(s.round_id, s);
  const rpMap = new Map<string, any>();
  for (const r of (roundPoints ?? []) as any[]) rpMap.set(r.round_id, r);

  const total = ((roundPoints ?? []) as any[]).reduce((a, b) => a + (b.total_points ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Moja istorija</h1>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Ukupno bodova</div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
        </div>
      </div>
      <div className="space-y-3">
        {((rounds ?? []) as Array<{ id: string; name: string }>).map((r) => {
          const snap = snapMap.get(r.id);
          const rp = rpMap.get(r.id);
          if (!snap && !rp) return null;
          return (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium">{r.name}</h2>
                <span className="font-bold tabular-nums">{rp?.total_points ?? "—"}</span>
              </div>
              {snap && (
                <div className="space-y-1 text-sm">
                  {([snap.player1_id, snap.player2_id, snap.player3_id] as (string | null)[]).map((pid, i) => {
                    const pp = pid ? ppMap.get(`${pid}_${r.id}`) : null;
                    const slotKey = `player${i + 1}_points` as const;
                    const pts = rp ? (rp[slotKey] ?? 0) : 0;
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span>{pid ? (playerMap.get(pid) ?? "?") : "—"}</span>
                        <span className="text-zinc-500 text-xs">
                          {pp ? `${pp.goals}G · ${pp.assists}A · ${pp.yellow_cards}🟨 · ${pp.red_cards}🟥` : "—"} · <b className="text-zinc-900">{pts}</b>
                        </span>
                      </div>
                    );
                  })}
                  {snap.transfer_penalty > 0 && (
                    <div className="flex items-center justify-between text-amber-700">
                      <span>Penal za transfere ({snap.transfers_used - 1})</span>
                      <span>−{snap.transfer_penalty}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(snapshots?.length ?? 0) === 0 && <p className="text-sm text-zinc-500">Još nemaš ni jedno zaključano kolo.</p>}
      </div>
    </div>
  );
}
