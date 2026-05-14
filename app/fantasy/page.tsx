import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

export default async function FantasyLandingPage() {
  const profile = await getCurrentProfile();
  return (
    <div className="space-y-6">
      <section className="rounded-2xl p-6 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <h1 className="text-2xl font-bold">Fantasy turnira</h1>
        <p className="text-emerald-50 mt-2">Izaberi 3 igrača. Skupljaj bodove. Takmiči se sa drugarima u privatnim ligama.</p>
        {profile ? (
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href="/fantasy/team" className="bg-white text-emerald-700 rounded-md px-4 py-2 text-sm font-medium">Moj tim</Link>
            <Link href="/fantasy/leagues" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Lige</Link>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <Link href="/auth/register" className="bg-white text-emerald-700 rounded-md px-4 py-2 text-sm font-medium">Registracija</Link>
            <Link href="/auth/login" className="border border-white/40 rounded-md px-4 py-2 text-sm font-medium">Prijava</Link>
          </div>
        )}
      </section>

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
        <h2 className="font-semibold mb-2">Transferi</h2>
        <p className="text-sm text-zinc-700">Tim sastavljaš pre prvog kola i možeš ga menjati između kola. Prvi transfer u svakom kolu je besplatan — svaki sledeći košta <b>−4 boda</b>.</p>
      </section>
    </div>
  );
}
