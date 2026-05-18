import Link from "next/link";
import { TeamCrest } from "@/components/TeamCrest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupStandings } from "@/lib/standings";
import { DrawStatusBanner } from "@/components/DrawStatusBanner";
import { StandingsRealtime } from "./StandingsRealtime";

export const revalidate = 0;

export default async function StandingsPage() {
  const groups = await getGroupStandings();
  const adminRO = createAdminClient();
  const { data: drawStateRow } = groups.length === 0
    ? await adminRO.from("draw_state").select("state, scheduled_at, per_pick_ms, result").eq("id", true).maybeSingle()
    : { data: null };
  return (
    <>
      <StandingsRealtime />
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Tabele po grupama</h1>
        {groups.length === 0 && (
          <div className="space-y-3">
            <DrawStatusBanner initial={(drawStateRow as any) ?? null} />
            <p className="text-sm text-zinc-500">{(drawStateRow as any)?.state && (drawStateRow as any).state !== "idle" && (drawStateRow as any).state !== "committed" ? "Čeka se da admin potvrdi rezultat žreba." : "Žreb još nije održan."}</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.group_id} className="card">
            <h2 className="font-medium mb-2">{g.group_name}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="text-left py-2 w-6">#</th>
                    <th className="text-left">Tim</th>
                    <th className="text-right">O</th>
                    <th className="text-right">P</th>
                    <th className="text-right">N</th>
                    <th className="text-right">I</th>
                    <th className="text-right">G+</th>
                    <th className="text-right">G−</th>
                    <th className="text-right">GR</th>
                    <th className="text-right">B</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={r.team_id} className="border-t border-zinc-100">
                      <td className="py-2 text-zinc-500">{i + 1}.</td>
                      <td className="font-medium">
                        <Link href={`/teams/${r.team_id}`} className="inline-flex items-center gap-2 hover:text-blue-700">
                          <TeamCrest name={r.team_name} shortName={r.short_name} primaryColor={r.primary_color} secondaryColor={r.secondary_color} size={24} />
                          {r.team_name}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{r.played}</td>
                      <td className="text-right tabular-nums">{r.won}</td>
                      <td className="text-right tabular-nums">{r.drawn}</td>
                      <td className="text-right tabular-nums">{r.lost}</td>
                      <td className="text-right tabular-nums">{r.goals_for}</td>
                      <td className="text-right tabular-nums">{r.goals_against}</td>
                      <td className="text-right tabular-nums">{r.goal_diff}</td>
                      <td className="text-right tabular-nums font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
