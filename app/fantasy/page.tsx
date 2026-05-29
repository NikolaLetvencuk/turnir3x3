import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}

export default async function FantasyLandingPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <h1 className="text-2xl font-bold">Fantasy turnira</h1>
          <p className="text-blue-50 mt-2">
            Svaki dan biraš 3 igrača — sakupljaš bodove na osnovu njihovih utakmica tog dana.
            Bez budžeta i transfera, samo brzo nameštaj tim kad ti odgovara.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/auth/register" className="bg-zinc-900 text-blue-300 rounded-md px-4 py-2 text-sm font-medium">
              Registracija
            </Link>
            <Link href="/auth/login" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">
              Prijava
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const admin = createAdminClient();
  const [{ data: dayPoints }, { data: teamRow }, { data: memberships }] = await Promise.all([
    (admin as any)
      .from("fantasy_day_points")
      .select("day, total_points")
      .eq("user_id", profile.id)
      .order("day", { ascending: false }),
    admin.from("fantasy_teams").select("name").eq("user_id", profile.id).maybeSingle(),
    admin
      .from("fantasy_league_members")
      .select("league_id, league:fantasy_leagues(id, name, invite_code, owner_id)")
      .eq("user_id", profile.id),
  ]);

  const dpRows = (dayPoints ?? []) as Array<{ day: string; total_points: number }>;
  const totalPoints = dpRows.reduce((acc, r) => acc + (r.total_points ?? 0), 0);
  const lastDay = dpRows[0] ?? null;
  const teamName = ((teamRow ?? null) as any)?.name ?? null;
  const leagues = ((memberships ?? []) as any[]).map((m) => m.league).filter(Boolean) as Array<{
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
  }>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <h1 className="text-2xl font-bold">Fantasy</h1>
        <div className="text-xs text-blue-50/80 mt-0.5">{teamName ?? "Postavi ime tima u 'Sastavi tim'"}</div>
        <div className="mt-4 flex flex-wrap items-baseline gap-6">
          <div>
            <div className="text-xs text-blue-50/80">Ukupno bodova</div>
            <div className="text-4xl font-black tabular-nums">{totalPoints}</div>
          </div>
          <div>
            <div className="text-xs text-blue-50/80">{lastDay ? formatSrDate(lastDay.day) : "Prošli dan"}</div>
            <div className="text-2xl font-bold tabular-nums">
              {lastDay ? lastDay.total_points : <span className="text-blue-50/70 text-sm">—</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/fantasy/team"
            className="bg-zinc-900 text-blue-300 rounded-md px-4 py-3 text-sm font-semibold text-center"
          >
            ⚽ Sastavi tim
          </Link>
          <Link
            href="/fantasy/team/history"
            className="bg-zinc-900 text-blue-300 rounded-md px-4 py-3 text-sm font-semibold text-center"
          >
            📊 Pregledaj poene
          </Link>
        </div>
        <div className="mt-2">
          <Link
            href="/fantasy/leagues"
            className="block bg-white/15 text-white border border-white/40 rounded-md px-4 py-2 text-sm font-medium text-center"
          >
            🏆 Lige
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Moje lige</h2>
          <Link href="/fantasy/leagues" className="text-xs text-blue-300 hover:underline">
            + Kreiraj / Pridruži se →
          </Link>
        </div>
        {leagues.length === 0 ? (
          <Link href="/fantasy/leagues" className="card block text-sm text-zinc-400 hover:border-blue-300">
            Još nisi u ni jednoj ligi. Klikni ovde da kreiraš novu ili se pridružiš preko koda.
          </Link>
        ) : (
          <div className="space-y-2">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/fantasy/leagues/${l.id}`}
                className="card flex items-center justify-between gap-2 hover:border-blue-300"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-xs text-zinc-500">
                    kod <span className="font-mono">{l.invite_code}</span>
                  </div>
                </div>
                <span className="text-blue-300 text-sm">Otvori →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Pravila bodovanja</h2>
        <ul className="text-sm space-y-1 text-zinc-300">
          <li>⚽ Gol — <b>+3</b></li>
          <li>🅰️ Asistencija — <b>+2</b></li>
          <li>✅ Pobeda tima — <b>+1</b></li>
          <li>🧤 Čista mreža — <b>+1</b></li>
          <li>🟨 Žuti karton — <b>−1</b></li>
          <li>🟥 Crveni karton — <b>−2</b></li>
          <li>🥅 Autogol — <b>−1</b></li>
        </ul>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-2">Kako se igra</h2>
        <ol className="text-sm space-y-1 text-zinc-300 list-decimal list-inside">
          <li>Postavi <b>ime tima</b> (jednom, ne menja se).</li>
          <li>Svaki dan izabereš <b>3 igrača</b> — bez budžeta, bez cena, bez ograničenih transfera.</li>
          <li>
            U <b>grupnoj fazi</b>: sva 3 igrača iz različitih timova. Od <b>četvrtfinala</b> nadalje:
            najviše 2 iz istog tima.
          </li>
          <li>Picks se zaključavaju kad prvi meč tog dana počne.</li>
          <li>
            Ako ne nameštaš tim za neki dan, automatski se koristi tvoj poslednji sastavljen tim.
          </li>
        </ol>
      </section>
    </div>
  );
}
