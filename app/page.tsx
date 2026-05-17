import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchCard } from "@/components/matches/MatchCard";
import { getGroupStandings, getTopScorers } from "@/lib/standings";
import { TeamCrest } from "@/components/TeamCrest";
import { LiveRefresh } from "@/components/LiveRefresh";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = createClient();
  const [liveRes, upcomingRes, recentRes, groups, scorers] = await Promise.all([
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color)").eq("status", "live").order("started_at", { ascending: false }),
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color)").eq("status", "scheduled").order("kickoff_at").limit(5),
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color)").eq("status", "finished").order("finished_at", { ascending: false }).limit(5),
    getGroupStandings(),
    getTopScorers(5),
  ]);
  const live = (liveRes.data ?? []) as any[];
  const upcoming = (upcomingRes.data ?? []) as any[];
  const recent = (recentRes.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <LiveRefresh tag="home" />
      <section className="rounded-2xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <h1 className="text-2xl font-bold">Turnir Kula</h1>
        <p className="text-emerald-50 mt-1 text-sm">Liparski put · uživo rezultati, tabele i fantasy liga</p>
        <Link href="/fantasy" className="mt-4 inline-flex items-center gap-2 bg-white text-emerald-700 rounded-md px-4 py-2 text-sm font-medium">
          Sastavi svoj fantasy tim →
        </Link>
      </section>

      {live.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2"><span className="live-dot" /> Uživo</h2>
          <div className="space-y-2">{live.map((m: any) => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">Naredni mečevi</h2>
        {upcoming.length > 0 ? (
          <div className="space-y-2">{upcoming.map((m: any) => <MatchCard key={m.id} match={m} />)}</div>
        ) : (
          <p className="text-sm text-zinc-500">Trenutno nema zakazanih mečeva.</p>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Poslednji rezultati</h2>
        {recent.length > 0 ? (
          <div className="space-y-2">{recent.map((m: any) => <MatchCard key={m.id} match={m} />)}</div>
        ) : (
          <p className="text-sm text-zinc-500">Još nema odigranih mečeva.</p>
        )}
      </section>

      {groups.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Tabele — top 3 po grupi</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {groups.map((g) => (
              <div key={g.group_id} className="card">
                <div className="font-medium mb-2">{g.group_name}</div>
                <table className="w-full text-xs">
                  <tbody>
                    {g.rows.slice(0, 3).map((r, i) => (
                      <tr key={r.team_id} className="border-b last:border-0 border-zinc-100">
                        <td className="py-1 text-zinc-500 w-6">{i + 1}.</td>
                        <td className="py-1 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <TeamCrest name={r.team_name} shortName={(r as any).short_name ?? null} primaryColor={(r as any).primary_color ?? null} secondaryColor={(r as any).secondary_color ?? null} size={18} />
                            {r.team_name}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums text-zinc-500">{r.played}</td>
                        <td className="py-1 text-right tabular-nums font-semibold">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <Link href="/standings" className="text-sm text-emerald-700 mt-2 inline-block">Sve tabele →</Link>
        </section>
      )}

      {scorers.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Najbolji strelci</h2>
          <div className="card">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-zinc-500"><th className="text-left py-1">Igrač</th><th className="text-left">Tim</th><th className="text-right">G</th><th className="text-right">A</th></tr></thead>
              <tbody>
                {scorers.map((s) => (
                  <tr key={s.player_id} className="border-t border-zinc-100">
                    <td className="py-1.5">{s.player_name}</td>
                    <td className="text-zinc-500">{s.team_name ?? "—"}</td>
                    <td className="text-right tabular-nums font-semibold">{s.goals}</td>
                    <td className="text-right tabular-nums">{s.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
