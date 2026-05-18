import { createClient } from "@/lib/supabase/server";
import { getPopupAdSetting } from "@/lib/settings";
import { PopupAdToggle } from "./PopupAdToggle";

export const revalidate = 0;

export default async function AdminDashboard() {
  const supabase = createClient();
  const [{ count: teamsCount }, { count: playersCount }, { count: roundsCount }, { count: matchesCount }, { data: liveMatches }, { data: roundsRaw }, popup] = await Promise.all([
    supabase.from("teams").select("*", { head: true, count: "exact" }),
    supabase.from("players").select("*", { head: true, count: "exact" }),
    supabase.from("rounds").select("*", { head: true, count: "exact" }),
    supabase.from("matches").select("*", { head: true, count: "exact" }),
    supabase.from("matches").select("id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), home_score, away_score").eq("status", "live"),
    supabase.from("rounds").select("*").order("display_order"),
    getPopupAdSetting(),
  ]);
  const rounds = (roundsRaw ?? []) as Array<{ id: string; name: string; status: string }>;
  const activeRound = rounds.find((r) => r.status === "active");
  const stats = [
    ["Timovi", teamsCount ?? 0],
    ["Igrači", playersCount ?? 0],
    ["Kola", roundsCount ?? 0],
    ["Mečevi", matchesCount ?? 0],
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin pregled</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(([l, v]) => (
          <div key={l} className="card text-center">
            <div className="text-xs text-zinc-500">{l}</div>
            <div className="text-2xl font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="font-medium mb-2">Aktivno kolo</h2>
        {activeRound ? <p className="text-sm">{activeRound.name} — <span className="badge-live"><span className="live-dot" />aktivno</span></p> : <p className="text-sm text-zinc-500">Nema aktivnog kola.</p>}
      </div>
      <div className="card">
        <h2 className="font-medium mb-2">Sajt</h2>
        <PopupAdToggle initialEnabled={popup.enabled} />
      </div>
      <div className="card">
        <h2 className="font-medium mb-2">Mečevi uživo</h2>
        {(liveMatches ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">Trenutno nema mečeva uživo.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(liveMatches ?? []).map((m: any) => (
              <li key={m.id}><a className="hover:underline" href={`/admin/matches/${m.id}/live`}>{m.home_team?.name} {m.home_score}:{m.away_score} {m.away_team?.name}</a></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
