import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTopScorers } from "@/lib/standings";

export const revalidate = 0;

export default async function PlayersPage({ searchParams }: { searchParams: { sort?: string } }) {
  const supabase = createClient();
  const [pricesRes, scorers] = await Promise.all([
    supabase.from("player_prices").select("player_id, price, round_id, round:rounds(display_order)").order("round_id"),
    getTopScorers(500),
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
  const rows = scorers.map((s) => ({ ...s, price: priceMap.get(s.player_id) ?? 10.0 }));
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
          <Link key={k} href={`/players?sort=${k}`} className={`px-3 py-1 rounded-full border ${sort===k?"bg-emerald-600 text-white border-emerald-600":"bg-white text-zinc-700 border-zinc-200"}`}>{l}</Link>
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
              <tr key={r.player_id} className="border-t border-zinc-100">
                <td className="py-2"><Link href={`/players/${r.player_id}`} className="hover:text-emerald-700 font-medium">{r.player_name}</Link></td>
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
