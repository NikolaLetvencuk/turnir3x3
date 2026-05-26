import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { LeagueForms } from "./LeagueForms";
import { MAX_LEAGUES_PER_USER } from "./constants";

export const revalidate = 0;

export default async function LeaguesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/leagues");
  const supabase = createClient();
  const [{ data: memberships }, { count: ownedCount }] = await Promise.all([
    supabase
      .from("fantasy_league_members")
      .select("league_id, league:fantasy_leagues(id, name, invite_code, owner_id)")
      .eq("user_id", profile.id),
    supabase
      .from("fantasy_leagues")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id),
  ]);
  const leagues = (memberships ?? []).map((m: any) => m.league).filter(Boolean);
  const ownedTotal = ownedCount ?? 0;
  const remaining = Math.max(0, MAX_LEAGUES_PER_USER - ownedTotal);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Moje lige</h1>
      <LeagueForms remainingCreates={remaining} maxCreates={MAX_LEAGUES_PER_USER} />
      {leagues.length === 0 ? (
        <p className="text-sm text-zinc-500">Još nisi član ni jedne lige.</p>
      ) : (
        <div className="space-y-2">
          {leagues.map((l: any) => (
            <Link key={l.id} href={`/fantasy/leagues/${l.id}`} className="card flex items-center justify-between hover:border-blue-300">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-zinc-500">
                  Kod: <span className="font-mono">{l.invite_code}</span>
                  {l.owner_id === profile.id && <span className="ml-2 text-amber-300">· tvoja</span>}
                </div>
              </div>
              <span className="text-blue-300 text-sm">Otvori →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
