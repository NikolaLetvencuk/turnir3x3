import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getFantasyOverview, FANTASY_BUDGET } from "@/lib/fantasy";

export const revalidate = 0;

export default async function FantasyLandingPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <h1 className="text-2xl font-bold">Fantasy turnira</h1>
          <p className="text-blue-50 mt-2">Izaberi 3 igrača (budžet {FANTASY_BUDGET.toFixed(0)}M). Skupljaj bodove. Takmiči se sa drugarima u privatnim ligama.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/auth/register" className="bg-white text-blue-700 rounded-md px-4 py-2 text-sm font-medium">Registracija</Link>
            <Link href="/auth/login" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Prijava</Link>
          </div>
        </section>
      </div>
    );
  }

  const overview = await getFantasyOverview(profile.id);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <h1 className="text-2xl font-bold">Fantasy</h1>
        {overview.active_round ? (
          /* Live round in progress — emphasize this round's points */
          <div className="mt-4">
            <div className="text-xs text-blue-50/80 uppercase tracking-wide">
              {overview.active_round.name} · uživo
            </div>
            <div className="text-5xl sm:text-6xl font-black tabular-nums mt-1 leading-none">
              {overview.active_round_points ?? 0}
            </div>
            <div className="text-xs text-blue-50/80 mt-1">bodova u ovom kolu</div>
            <div className="mt-4 flex items-baseline gap-4 flex-wrap">
              <div>
                <div className="text-xs text-blue-50/80">Ukupno</div>
                <div className="text-2xl font-bold tabular-nums">{overview.total_points}</div>
              </div>
              {overview.overall_rank !== null && (
                <div>
                  <div className="text-xs text-blue-50/80">Pozicija ukupno</div>
                  <div className="text-2xl font-bold">{overview.overall_rank}.<span className="text-blue-50/70 text-sm font-normal"> od {overview.overall_total}</span></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No active round — show total + last round side by side */
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <div>
              <div className="text-xs text-blue-50/80">Ukupno</div>
              <div className="text-3xl font-bold tabular-nums">{overview.total_points}</div>
            </div>
            <div>
              <div className="text-xs text-blue-50/80">{overview.last_round_name ?? "Prošlo kolo"}</div>
              <div className="text-2xl font-bold tabular-nums">
                {overview.last_round_points === null ? <span className="text-blue-50/70 text-sm">još nije bilo</span> : overview.last_round_points}
              </div>
            </div>
            {overview.overall_rank !== null && (
              <div>
                <div className="text-xs text-blue-50/80">Pozicija ukupno</div>
                <div className="text-2xl font-bold">{overview.overall_rank}.<span className="text-blue-50/70 text-sm font-normal"> od {overview.overall_total}</span></div>
              </div>
            )}
          </div>
        )}
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link href="/fantasy/team/live" className="bg-white text-blue-700 rounded-md px-4 py-2 text-sm font-medium">Pregledaj tim</Link>
          <Link href="/fantasy/team" className="bg-white/15 text-white border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Sastavi tim za sledeće kolo</Link>
          <Link href="/fantasy/team/history" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Istorija</Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Moje lige</h2>
          <Link href="/fantasy/leagues" className="text-xs text-blue-700 hover:underline">+ Kreiraj / Pridruži se →</Link>
        </div>

        {overview.leagues.length === 0 ? (
          <Link href="/fantasy/leagues" className="card block text-sm text-zinc-600 hover:border-blue-300">
            Još nisi u ni jednoj ligi. Klikni ovde da kreiraš novu ili se pridružiš preko koda.
          </Link>
        ) : (
          <div className="space-y-2">
            {overview.leagues.map((l) => (
              <Link
                key={l.league_id}
                href={`/fantasy/leagues/${l.league_id}`}
                className="card flex items-center justify-between gap-2 hover:border-blue-300"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.league_name}</div>
                  <div className="text-xs text-zinc-500 flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>{l.member_count} {l.member_count === 1 ? "član" : "članova"}</span>
                    <span>·</span>
                    <span>kod <span className="font-mono">{l.invite_code}</span></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums">{l.my_rank}.</div>
                  <div className="text-xs text-zinc-500">od {l.member_count}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Pravila bodovanja</h2>
        <ul className="text-sm space-y-1 text-zinc-700">
          <li>⚽ Gol — <b>+4</b></li>
          <li>🅰️ Asistencija — <b>+2</b></li>
          <li>✅ Pobeda — <b>+3</b></li>
          <li>➖ Nerešeno — <b>+1</b></li>
          <li>❌ Poraz — <b>−1</b></li>
          <li>🧤 Čista mreža — <b>+3</b></li>
          <li>🟨 Žuti karton — <b>−1</b></li>
          <li>🟥 Crveni karton — <b>−2</b></li>
          <li>🥅 Autogol — <b>−1</b></li>
        </ul>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Cene i budžet</h2>
        <ul className="text-sm space-y-1 text-zinc-700">
          <li>Svaki igrač počinje na <b>10.0M</b>.</li>
          <li>Tvoj početni budžet je <b>{FANTASY_BUDGET.toFixed(0)}M</b>.</li>
          <li>Posle svakog kola: <b>cena = stara cena + 0.05 × (bodovi tog kola − 2)</b>, minimum <b>4.0M</b>.</li>
          <li>10 poena → +0.4M · 0 poena → −0.1M · −2 poena (crveni) → −0.2M.</li>
          <li>Tvoj budžet za naredno kolo = ukupna vrednost trenutnog lockovanog tima.</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Kako se igra</h2>
        <ol className="text-sm space-y-1 text-zinc-700 list-decimal list-inside">
          <li>Postavi <b>ime tima</b> (jednom, ne menja se).</li>
          <li>Sastavi tim od 3 igrača u okviru svog <b>budžeta</b>.</li>
          <li>Klikni <b>Sačuvaj tim</b> — tim važi za sva naredna kola dok ga ne promeniš.</li>
          <li>Ako ne dirneš tim, isti tim ostaje aktivan u svakom narednom kolu.</li>
        </ol>
      </section>
    </div>
  );
}
