import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MatchCard } from "@/components/matches/MatchCard";
import { getGroupStandings, getTopScorers } from "@/lib/standings";
import { TeamCrest } from "@/components/TeamCrest";
import { LiveRefresh } from "@/components/LiveRefresh";
import { DrawStatusBanner } from "@/components/DrawStatusBanner";
import { NewsBanner } from "@/components/NewsBanner";
import { PopupAd } from "@/components/PopupAd";
import { getPopupAdSetting } from "@/lib/settings";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const adminRO = createAdminClient();

  // Lightweight check first: do we have groups (= draw committed)?
  const { data: groupCheck } = await supabase.from("groups").select("id").limit(1);
  const hasGroups = (groupCheck?.length ?? 0) > 0;

  const [{ data: drawStateRow }, popup, { data: latestNews }] = await Promise.all([
    adminRO.from("draw_state").select("state, scheduled_at, per_pick_ms, result").eq("id", true).maybeSingle(),
    getPopupAdSetting(),
    adminRO.from("news").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const newsRow = (latestNews as { id: string; title: string; body: string; created_at: string } | null) ?? null;

  // Pre-draw view: only banner + team list
  if (!hasGroups) {
    const { data: teamsRows } = await supabase
      .from("teams")
      .select("id, name, short_name, primary_color, secondary_color, logo_url")
      .order("name");
    const teams = (teamsRows ?? []) as Array<{ id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null; logo_url?: string | null }>;

    return (
      <div className="space-y-6">
        <LiveRefresh tag="home-predraw" />
        <PopupAd enabled={popup.enabled} version={popup.updatedAt ?? "v0"} />
        <NewsBanner initial={newsRow} />
        <DrawStatusBanner initial={(drawStateRow as any) ?? null} />
        <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white relative overflow-hidden">
          <Image
            src="/logo/mkpetrovski.png"
            alt=""
            width={180}
            height={180}
            className="absolute -right-4 -top-4 opacity-25 rotate-12 pointer-events-none select-none"
          />
          <div className="relative flex items-center gap-3">
            <Image
              src="/logo/mkpetrovski.png"
              alt='Memorijalni Turnir "Vladislav Petrovski" Kula'
              width={56}
              height={56}
              className="rounded-lg shrink-0 bg-white/10 p-1"
            />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-blue-50/90 font-semibold">Memorijalni Turnir</div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">&ldquo;Vladislav Petrovski&rdquo; Kula</h1>
              <p className="text-blue-50 mt-0.5 text-sm">Liparski put · prijave su otvorene</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold">Prijavljene ekipe</h2>
            <span className="text-xs text-zinc-500 tabular-nums">{teams.length}</span>
          </div>
          {teams.length === 0 ? (
            <div className="card text-sm text-zinc-500 text-center py-8">
              Još nema prijavljenih ekipa.
            </div>
          ) : (
            <ul className="card divide-y divide-zinc-800 !p-0">
              {teams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/teams/${t.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800"
                  >
                    <TeamCrest
                      name={t.name}
                      shortName={t.short_name}
                      primaryColor={t.primary_color}
                      secondaryColor={t.secondary_color} logoUrl={t.logo_url}
                      size={32}
                    />
                    <span className="font-medium truncate flex-1 min-w-0">{t.name}</span>
                    {t.short_name && <span className="text-xs text-zinc-400 font-mono shrink-0">{t.short_name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // Post-draw view: full homepage
  const [liveRes, upcomingRes, recentRes, groups, scorers] = await Promise.all([
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url)").eq("status", "live").order("started_at", { ascending: false }),
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url)").eq("status", "scheduled").order("kickoff_at").limit(5),
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url)").eq("status", "finished").order("finished_at", { ascending: false }).limit(5),
    getGroupStandings(),
    getTopScorers(5),
  ]);
  const live = (liveRes.data ?? []) as any[];
  const upcoming = (upcomingRes.data ?? []) as any[];
  const recent = (recentRes.data ?? []) as any[];

  return (
    <div className="space-y-6">
      <LiveRefresh tag="home" />
      <PopupAd enabled={popup.enabled} version={popup.updatedAt ?? "v0"} />
      <NewsBanner initial={newsRow} />
      <DrawStatusBanner initial={(drawStateRow as any) ?? null} />
      <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white relative overflow-hidden">
        <Image
          src="/logo/mkpetrovski.png"
          alt=""
          width={180}
          height={180}
          className="absolute -right-4 -top-4 opacity-25 rotate-12 pointer-events-none select-none"
        />
        <div className="relative flex items-center gap-3">
          <Image
            src="/logo/mkpetrovski.png"
            alt='Memorijalni Turnir "Vladislav Petrovski" Kula'
            width={56}
            height={56}
            className="rounded-lg shrink-0 bg-white/10 p-1"
          />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-blue-50/90 font-semibold">Memorijalni Turnir</div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">&ldquo;Vladislav Petrovski&rdquo; Kula</h1>
            <p className="text-blue-50 mt-0.5 text-sm">Liparski put · uživo rezultati, tabele i fantasy liga</p>
          </div>
        </div>
        <Link href="/fantasy" className="mt-4 inline-flex items-center gap-2 bg-zinc-900 text-blue-300 rounded-md px-4 py-2 text-sm font-medium relative">
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
                      <tr key={r.team_id} className="border-b last:border-0 border-zinc-800">
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
          <Link href="/standings" className="text-sm text-blue-300 mt-2 inline-block">Sve tabele →</Link>
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
                  <tr key={s.player_id} className="border-t border-zinc-800">
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
