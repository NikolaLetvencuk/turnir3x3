import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getFantasyOverview, FANTASY_BUDGET } from "@/lib/fantasy";

export const revalidate = 0;

export default async function FantasyLandingPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
          <h1 className="text-2xl font-bold">Fantasy turnira</h1>
          <p className="text-emerald-50 mt-2">Izaberi 3 igrača (budžet {FANTASY_BUDGET.toFixed(0)}M). Skupljaj bodove. Takmiči se sa drugarima u privatnim ligama.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/auth/register" className="bg-white text-emerald-700 rounded-md px-4 py-2 text-sm font-medium">Registracija</Link>
            <Link href="/auth/login" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Prijava</Link>
          </div>
        </section>
      </div>
    );
  }

  const overview = await getFantasyOverview(profile.id);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <h1 className="text-2xl font-bold">Fantasy</h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-4">
          <div>
            <div className="text-xs text-emerald-50/80">Ukupno</div>
            <div className="text-3xl font-bold tabular-nums">{overview.total_points}</div>
          </div>
          <div>
            <div className="text-xs text-emerald-50/80">{overview.last_round_name ?? "Prošlo kolo"}</div>
            <div className="text-2xl font-bold tabular-nums">
              {overview.last_round_points === null ? <span className="text-emerald-50/70 text-sm">još nije bilo</span> : overview.last_round_points}
            </div>
          </div>
          {overview.overall_rank !== null && (
            <div>
              <div className="text-xs text-emerald-50/80">Pozicija ukupno</div>
              <div className="text-2xl font-bold">{overview.overall_rank}.<span className="text-emerald-50/70 text-sm font-normal"> od {overview.overall_total}</span></div>
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link href="/fantasy/team" className="bg-white text-emerald-700 rounded-md px-4 py-2 text-sm font-medium">Moj tim</Link>
          <Link href="/fantasy/leagues" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Lige</Link>
        </div>
      </section>

      {overview.leagues.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Moje lige</h2>
          <div className="space-y-2">
            {overview.leagues.map((l) => (
              <Link
                key={l.league_id}
                href={`/fantasy/leagues/${l.league_id}`}
                className="card flex items-center justify-between gap-2 hover:border-emerald-300"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.league_name}</div>
                  <div className="text-xs text-zinc-500">{l.member_count} {l.member_count === 1 ? "član" : "članova"} · kod <span className="font-mono">{l.invite_code}</span></div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums">{l.my_rank}.</div>
                  <div className="text-xs text-zinc-500">od {l.member_count}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold mb-2">Pravila bodovanja</h2>
        <ul className="text-sm space-y-1 text-zinc-700">
          <li>⚽ Gol — <b>+5</b></li>
          <li>🅰️ Asistencija — <b>+3</b></li>
          <li>✅ Pobeda tima igrača — <b>+2</b></li>
          <li>➖ Nerešeno — <b>+1</b></li>
          <li>🧤 Čista mreža (tim primio 0) — <b>+2</b></li>
          <li>🟨 Žuti karton — <b>−1</b></li>
          <li>🟥 Crveni karton — <b>−3</b></li>
          <li>🥅 Autogol — <b>−2</b></li>
        </ul>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Kako se igra</h2>
        <ol className="text-sm space-y-1 text-zinc-700 list-decimal list-inside">
          <li>Sastavi tim od 3 igrača u okviru budžeta od <b>{FANTASY_BUDGET.toFixed(0)}M</b>. Svaki igrač počinje na 10M.</li>
          <li>Klikni <b>Lock</b> za naredno kolo. Možeš da menjaš pre nego što kolo počne.</li>
          <li>Ako ne lock-uješ za naredno kolo, koristi se prošli tim (ili 0 ako je prvo kolo).</li>
          <li>Nakon kola, cene se ažuriraju na osnovu performansa.</li>
        </ol>
      </section>
    </div>
  );
}
