import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getFantasyOverview } from "@/lib/fantasy";
import { signOut } from "@/app/auth/actions";

export const revalidate = 0;

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  const overview = await getFantasyOverview(profile.id);

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Profil</h1>

      <div className="card space-y-2">
        <div>
          <div className="text-xs text-zinc-500">Email</div>
          <div className="font-medium truncate">{profile.email}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Uloga</div>
          <div className="font-medium">{profile.role === "admin" ? "Administrator" : "Korisnik"}</div>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <div className="text-xs text-emerald-50/80">Ukupno fantasy bodova</div>
        <div className="text-3xl font-bold tabular-nums">{overview.total_points}</div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {overview.last_round_points !== null && (
            <div>
              <div className="text-xs text-emerald-50/80">{overview.last_round_name}</div>
              <div className="font-semibold tabular-nums">{overview.last_round_points}</div>
            </div>
          )}
          {overview.overall_rank !== null && (
            <div>
              <div className="text-xs text-emerald-50/80">Pozicija ukupno</div>
              <div className="font-semibold">{overview.overall_rank}. <span className="text-emerald-50/70 font-normal text-xs">od {overview.overall_total}</span></div>
            </div>
          )}
        </div>
      </div>

      {overview.leagues.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide px-1">Lige</div>
          {overview.leagues.map((l) => (
            <Link
              key={l.league_id}
              href={`/fantasy/leagues/${l.league_id}`}
              className="card flex items-center justify-between gap-2 hover:border-emerald-300"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{l.league_name}</div>
                <div className="text-xs text-zinc-500">{l.member_count} članova</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold tabular-nums">{l.my_rank}.</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Link href="/fantasy/team" className="btn-secondary w-full">Moj fantasy tim</Link>
        <Link href="/fantasy/team/history" className="btn-secondary w-full">Istorija kola</Link>
        <Link href="/fantasy/leagues" className="btn-secondary w-full">Sve lige</Link>
        {profile.role === "admin" && <Link href="/admin" className="btn-primary w-full">Admin panel</Link>}
        <form action={signOut}>
          <button className="btn-danger w-full">Odjava</button>
        </form>
      </div>
    </div>
  );
}
