import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/matches/MatchCard";

export const revalidate = 0;

export default async function MatchesPage({ searchParams }: { searchParams: { round?: string; status?: string } }) {
  const supabase = createClient();
  const [roundsRes, matchesRes] = await Promise.all([
    supabase.from("rounds").select("id, name, status, display_order, stage").order("display_order"),
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name), away_team:teams!matches_away_team_id_fkey(id,name,short_name), round:rounds(id,name,status,display_order)")
      .order("kickoff_at", { ascending: true }),
  ]);
  const rounds = (roundsRes.data ?? []) as Array<{ id: string; name: string }>;
  let matches = (matchesRes.data ?? []) as any[];
  if (searchParams.round) matches = matches.filter((m: any) => m.round_id === searchParams.round);
  if (searchParams.status) matches = matches.filter((m: any) => m.status === searchParams.status);

  const grouped = new Map<string, any[]>();
  for (const m of matches) {
    const key = (m as any).round?.name ?? "—";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Mečevi</h1>
        <form className="flex gap-2 text-sm">
          <select name="round" defaultValue={searchParams.round ?? ""} className="input !py-1">
            <option value="">Svako kolo</option>
            {(rounds ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select name="status" defaultValue={searchParams.status ?? ""} className="input !py-1">
            <option value="">Sve</option>
            <option value="live">Uživo</option>
            <option value="scheduled">Zakazano</option>
            <option value="finished">Završeno</option>
          </select>
          <button className="btn-secondary !py-1.5">Filter</button>
        </form>
      </div>

      {Array.from(grouped.entries()).map(([roundName, list]) => (
        <section key={roundName}>
          <h2 className="font-medium text-sm text-zinc-600 mb-2">{roundName}</h2>
          <div className="space-y-2">{list.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      ))}
      {matches.length === 0 && <p className="text-sm text-zinc-500">Nema mečeva za prikaz.</p>}
    </div>
  );
}
