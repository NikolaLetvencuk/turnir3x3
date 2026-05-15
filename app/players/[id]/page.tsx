import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamCrest } from "@/components/TeamCrest";

export const revalidate = 0;

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [playerRes, eventsRes, pointsRes, pricesRes] = await Promise.all([
    supabase.from("players").select("*, team:teams(*)").eq("id", params.id).maybeSingle(),
    supabase.from("match_events").select("*, match:matches(id, round_id, status), team:teams(name)").or(`player_id.eq.${params.id},assist_player_id.eq.${params.id}`),
    supabase.from("fantasy_player_points").select("*, round:rounds(name, display_order)").eq("player_id", params.id),
    supabase.from("player_prices").select("price, round:rounds(name, display_order)").eq("player_id", params.id),
  ]);
  const player = playerRes.data as any;
  const events = (eventsRes.data ?? []) as any[];
  const points = (pointsRes.data ?? []) as any[];
  const prices = (pricesRes.data ?? []) as any[];
  if (!player) notFound();

  const stats = {
    goals: 0, assists: 0, ownGoals: 0, yellows: 0, reds: 0,
  };
  for (const e of events) {
    if (e.event_type === "goal" && e.player_id === params.id) stats.goals++;
    if (e.event_type === "own_goal" && e.player_id === params.id) stats.ownGoals++;
    if (e.event_type === "yellow_card" && e.player_id === params.id) stats.yellows++;
    if (e.event_type === "red_card" && e.player_id === params.id) stats.reds++;
    if (e.assist_player_id === params.id) stats.assists++;
  }

  const pointsByRound = points.sort((a: any, b: any) => (a.round?.display_order ?? 0) - (b.round?.display_order ?? 0));
  const sortedPrices = prices.sort((a: any, b: any) => (a.round?.display_order ?? 0) - (b.round?.display_order ?? 0));
  const latestPrice = sortedPrices[sortedPrices.length - 1]?.price ?? 10.0;

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4">
        <PlayerAvatar name={player.name} photoUrl={player.photo_url} teamPrimary={player.team?.primary_color} size={72} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{player.name}</h1>
          <p className="text-sm text-zinc-500 inline-flex items-center gap-2">
            {player.team ? (
              <>
                <TeamCrest name={player.team.name} shortName={player.team.short_name} primaryColor={player.team.primary_color} secondaryColor={player.team.secondary_color} size={20} />
                <span>{player.team.name}</span>
              </>
            ) : "Bez tima"}
          </p>
          <p className="text-sm mt-2">Trenutna cena: <span className="font-semibold">{Number(latestPrice).toFixed(2)}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {([["Golovi",stats.goals],["Asistencije",stats.assists],["Aut. golovi",stats.ownGoals],["Žuti",stats.yellows],["Crveni",stats.reds]] as const).map(([l,v]) => (
          <div key={l} className="card text-center">
            <div className="text-xs text-zinc-500">{l}</div>
            <div className="text-2xl font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {pointsByRound.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold mb-2">Fantasy bodovi po kolu</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-zinc-500"><th className="text-left py-1">Kolo</th><th className="text-right">G</th><th className="text-right">A</th><th className="text-right">CS</th><th className="text-right">Pob</th><th className="text-right">Ner</th><th className="text-right">🟨</th><th className="text-right">🟥</th><th className="text-right">AG</th><th className="text-right">Bod</th></tr></thead>
            <tbody>
              {pointsByRound.map((p: any) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-1">{p.round?.name}</td>
                  <td className="text-right">{p.goals}</td>
                  <td className="text-right">{p.assists}</td>
                  <td className="text-right">{p.clean_sheets}</td>
                  <td className="text-right">{p.wins}</td>
                  <td className="text-right">{p.draws}</td>
                  <td className="text-right">{p.yellow_cards}</td>
                  <td className="text-right">{p.red_cards}</td>
                  <td className="text-right">{p.own_goals}</td>
                  <td className="text-right font-bold">{p.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
