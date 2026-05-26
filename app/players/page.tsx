import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getTopScorers } from "@/lib/standings";

export const revalidate = 0;

export default async function PlayersPage({ searchParams }: { searchParams: { sort?: string } }) {
  const supabase = createClient();
  const [pricesRes, scorers, playersRes, teamsRes] = await Promise.all([
    supabase.from("player_prices").select("player_id, price, round_id, round:rounds(display_order)").order("round_id"),
    getTopScorers(500),
    supabase.from("players").select("id, photo_url, team_id"),
    supabase.from("teams").select("id, primary_color"),
  ]);
  const prices = (pricesRes.data ?? []) as any[];
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    const id = p.player_id;
    const order = p.round?.display_order ?? 0;
    const prev = priceMap.get(id);
    if (prev == null || (priceMap.get(`${id}_o`) ?? -1) <= order) {
      priceMap.set(id, Number(p.price));
      priceMap.set(`${id}_o`, order);
    }
  }
  const players = (playersRes.data ?? []) as Array<{ id: string; photo_url: string | null; team_id: string | null }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; primary_color: string | null }>;
  const playerMeta = new Map(players.map((p) => [p.id, p]));
  const teamMeta = new Map(teams.map((t) => [t.id, t]));
  const rows = scorers.map((s) => {
    const pm = playerMeta.get(s.player_id);
    return {
      ...s,
      price: priceMap.get(s.player_id) ?? 10.0,
      photo_url: pm?.photo_url ?? null,
      team_primary: pm?.team_id ? teamMeta.get(pm.team_id)?.primary_color ?? null : null,
    };
  });
  const sort = searchParams.sort ?? "goals";
  rows.sort((a, b) => {
    if (sort === "assists") return b.assists - a.assists;
    if (sort === "yellows") return b.yellow_cards - a.yellow_cards;
    if (sort === "reds") return b.red_cards - a.red_cards;
    if (sort === "price") return b.price - a.price;
    return b.goals - a.goals;
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Igrači</h1>
      <div className="flex flex-wrap gap-2 text-xs">
        {([["goals","Golovi"],["assists","Asistencije"],["yellows","Žuti"],["reds","Crveni"],["price","Cena"]] as const).map(([k,l]) => (
          <Link key={k} href={`/players?sort=${k}`} className={`px-3 py-1 rounded-full border ${sort===k?"bg-blue-600 text-white border-blue-600":"bg-zinc-900 text-zinc-300 border-zinc-800"}`}>{l}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th className="text-left py-2">Igrač</th>
              <th className="text-left">Tim</th>
              <th className="text-right">G</th>
              <th className="text-right">A</th>
              <th className="text-right">🟨</th>
              <th className="text-right">🟥</th>
              <th className="text-right">Cena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id} className="border-t border-zinc-800">
                <td className="py-2">
                  <Link href={`/players/${r.player_id}`} className="hover:text-blue-700 font-medium inline-flex items-center gap-2">
                    <PlayerAvatar name={r.player_name} photoUrl={r.photo_url} teamPrimary={r.team_primary} size={28} />
                    {r.player_name}
                  </Link>
                </td>
                <td className="text-zinc-500">{r.team_name ?? "—"}</td>
                <td className="text-right tabular-nums">{r.goals}</td>
                <td className="text-right tabular-nums">{r.assists}</td>
                <td className="text-right tabular-nums">{r.yellow_cards}</td>
                <td className="text-right tabular-nums">{r.red_cards}</td>
                <td className="text-right tabular-nums">{r.price.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-zinc-500">Nema igrača.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
