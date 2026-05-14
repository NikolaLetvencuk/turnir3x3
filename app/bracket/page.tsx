import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const revalidate = 0;

export default async function BracketPage() {
  const supabase = createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), round:rounds(name, stage)")
    .order("kickoff_at");

  const knockout = (matches ?? []).filter((m: any) => m.round?.stage === "knockout");

  const groups = new Map<string, any[]>();
  for (const m of knockout) {
    const key = (m as any).round?.name ?? "Eliminacija";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Eliminaciona faza</h1>
      {knockout.length === 0 && <p className="text-sm text-zinc-500">Eliminaciona faza još nije objavljena.</p>}
      {Array.from(groups.entries()).map(([name, list]) => (
        <section key={name}>
          <h2 className="font-medium text-sm text-zinc-600 mb-2">{name}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((m: any) => (
              <div key={m.id} className="card">
                <div className="text-xs text-zinc-500 mb-2">{m.bracket_position ?? "—"} · {formatDateTime(m.kickoff_at)}</div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.home_team?.name}</span>
                  <span className="font-bold tabular-nums">{m.home_score} : {m.away_score}</span>
                  <span className="font-medium">{m.away_team?.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
