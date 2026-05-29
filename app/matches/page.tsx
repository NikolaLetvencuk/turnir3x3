import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MatchCard } from "@/components/matches/MatchCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { DrawStatusBanner } from "@/components/DrawStatusBanner";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function belgradeKeyOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
function belgradeToday(): string {
  return belgradeKeyOf(new Date().toISOString());
}
const SR_MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const SR_WEEKDAYS = ["nedelja", "ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota"];
function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${SR_WEEKDAYS[wd]}, ${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}

export default async function MatchesPage({ searchParams }: { searchParams: { day?: string } }) {
  const supabase = createClient();
  const { data: matchesRaw } = await supabase
    .from("matches")
    .select("*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), round:rounds(id,name,status,display_order)")
    .order("kickoff_at", { ascending: true });

  const all = (matchesRaw ?? []) as any[];

  // Draw not held yet → banner.
  if (all.length === 0) {
    const adminRO = createAdminClient();
    const { data: drawStateRow } = await adminRO
      .from("draw_state")
      .select("state, scheduled_at, per_pick_ms, result")
      .eq("id", true)
      .maybeSingle();
    return (
      <div className="space-y-4">
        <LiveRefresh tag="matches" />
        <h1 className="text-xl font-semibold">Mečevi</h1>
        <DrawStatusBanner initial={drawStateRow as any} />
        <p className="text-sm text-zinc-500">
          {drawStateRow?.state && drawStateRow.state !== "idle" && drawStateRow.state !== "committed"
            ? "Čeka se da admin potvrdi rezultat žreba."
            : "Žreb još nije održan."}
        </p>
      </div>
    );
  }

  // Distinct Belgrade match days (sorted). Matches without kickoff go to a
  // separate "no date" bucket shown only when there are no dated matches.
  const dayKeys = Array.from(
    new Set(all.filter((m) => m.kickoff_at).map((m) => belgradeKeyOf(m.kickoff_at))),
  ).sort();

  const today = belgradeToday();
  // Default day: requested → today (if it has matches) → nearest upcoming →
  // last available.
  let day = searchParams.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day) ? searchParams.day : "";
  if (!day || !dayKeys.includes(day)) {
    if (dayKeys.includes(today)) day = today;
    else {
      const upcoming = dayKeys.find((d) => d >= today);
      day = upcoming ?? dayKeys[dayKeys.length - 1] ?? today;
    }
  }

  const idx = dayKeys.indexOf(day);
  const prevDay = idx > 0 ? dayKeys[idx - 1] : null;
  const nextDay = idx >= 0 && idx < dayKeys.length - 1 ? dayKeys[idx + 1] : null;

  const isLive = (m: any) =>
    m.status === "live" || ["first_half", "halftime", "second_half"].includes(m.phase);

  const dayMatches = all
    .filter((m) => m.kickoff_at && belgradeKeyOf(m.kickoff_at) === day)
    .sort((a, b) => {
      // Live first, then by kickoff time.
      const la = isLive(a) ? 0 : 1;
      const lb = isLive(b) ? 0 : 1;
      if (la !== lb) return la - lb;
      return (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? "");
    });

  return (
    <div className="space-y-4">
      <LiveRefresh tag="matches" />
      <h1 className="text-xl font-semibold">Mečevi</h1>

      {/* Day navigator */}
      <div className="flex items-center justify-between gap-2">
        {prevDay ? (
          <Link href={`/matches?day=${prevDay}`} className="btn-secondary !py-2 !px-3 inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : (
          <span className="btn-secondary !py-2 !px-3 opacity-40 cursor-not-allowed inline-flex">
            <ChevronLeft className="w-4 h-4" />
          </span>
        )}
        <div className="flex-1 text-center">
          <div className="inline-flex items-center gap-1.5 font-semibold">
            <Calendar className="w-4 h-4 text-zinc-400" />
            {formatDayLabel(day)}
            {day === today && <span className="text-[10px] uppercase tracking-wider text-emerald-300">danas</span>}
          </div>
        </div>
        {nextDay ? (
          <Link href={`/matches?day=${nextDay}`} className="btn-secondary !py-2 !px-3 inline-flex items-center gap-1">
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="btn-secondary !py-2 !px-3 opacity-40 cursor-not-allowed inline-flex">
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>

      {dayMatches.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-6">Nema mečeva za ovaj dan.</p>
      ) : (
        <div className="space-y-2">
          {dayMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
