import Link from "next/link";
import {
  Users,
  User,
  Sparkles,
  ListChecks,
  Radio,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPopupAdSetting } from "@/lib/settings";
import { PopupAdToggle } from "./PopupAdToggle";

export const revalidate = 0;

export default async function AdminDashboard() {
  const supabase = createClient();
  const admin = createAdminClient();
  const [
    { count: teamsCount },
    { count: playersCount },
    { count: roundsCount },
    { count: matchesCount },
    { data: liveMatches },
    { data: roundsRaw },
    { data: drawStateRow },
    popup,
  ] = await Promise.all([
    supabase.from("teams").select("*", { head: true, count: "exact" }),
    supabase.from("players").select("*", { head: true, count: "exact" }),
    supabase.from("rounds").select("*", { head: true, count: "exact" }),
    supabase.from("matches").select("*", { head: true, count: "exact" }),
    supabase
      .from("matches")
      .select(
        "id, home_team:teams!matches_home_team_id_fkey(name, primary_color), away_team:teams!matches_away_team_id_fkey(name, primary_color), home_score, away_score",
      )
      .eq("status", "live"),
    supabase.from("rounds").select("*").order("display_order"),
    admin.from("draw_state").select("state, scheduled_at").eq("id", true).maybeSingle(),
    getPopupAdSetting(),
  ]);
  const rounds = (roundsRaw ?? []) as Array<{ id: string; name: string; status: string }>;
  const activeRound = rounds.find((r) => r.status === "active");
  const drawState = (drawStateRow as { state: string; scheduled_at: string | null } | null) ?? null;

  // Decide "next big action" the admin should take.
  let nextAction: { href: string; label: string; hint: string } | null = null;
  if ((teamsCount ?? 0) === 0) {
    nextAction = { href: "/admin/teams", label: "Dodaj prvi tim", hint: "Pre svega, unesi učesnike." };
  } else if ((playersCount ?? 0) === 0) {
    nextAction = { href: "/admin/players", label: "Dodaj igrače", hint: "Bez igrača ne može unos golova." };
  } else if (!drawState || drawState.state === "idle") {
    nextAction = { href: "/admin/draw", label: "Pokreni žreb", hint: "Razvrstaj timove u grupe." };
  } else if (drawState.state === "scheduled") {
    nextAction = { href: "/admin/draw", label: "Žreb zakazan", hint: drawState.scheduled_at ?? "" };
  } else if (!activeRound && (roundsCount ?? 0) > 0) {
    nextAction = { href: "/admin/matches", label: "Pokreni meč", hint: "Otvori prvi meč u rasporedu." };
  }

  return (
    <div className="space-y-4">
      {/* Stats — big colourful tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile icon={<Users className="w-5 h-5" />} label="Timovi" value={teamsCount ?? 0} tone="blue" href="/admin/teams" />
        <StatTile icon={<User className="w-5 h-5" />} label="Igrači" value={playersCount ?? 0} tone="emerald" href="/admin/players" />
        <StatTile icon={<Sparkles className="w-5 h-5" />} label="Kola" value={roundsCount ?? 0} tone="amber" href="/admin/schedule" />
        <StatTile icon={<ListChecks className="w-5 h-5" />} label="Mečevi" value={matchesCount ?? 0} tone="purple" href="/admin/matches" />
      </div>

      {/* Next action prompt */}
      {nextAction && (
        <Link
          href={nextAction.href}
          className="card flex items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
        >
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-blue-100">Sledeći korak</div>
            <div className="font-bold text-lg truncate">{nextAction.label}</div>
            {nextAction.hint && <div className="text-xs text-blue-100/90 mt-0.5">{nextAction.hint}</div>}
          </div>
          <ArrowRight className="w-6 h-6 shrink-0" />
        </Link>
      )}

      {/* Active round + live matches in one card */}
      <div className="card">
        <h2 className="font-semibold text-sm flex items-center gap-1.5 mb-2">
          <Radio className="w-4 h-4 text-red-600" />
          Šta se trenutno dešava
        </h2>
        {activeRound ? (
          <div className="text-sm">
            <span className="badge-live"><span className="live-dot" />{activeRound.name}</span>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Trenutno nije aktivno nijedno kolo.</p>
        )}
        {(liveMatches ?? []).length > 0 && (
          <ul className="mt-2 space-y-1">
            {(liveMatches ?? []).map((m: any) => (
              <li key={m.id}>
                <Link
                  href={`/admin/matches/${m.id}/live`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50 text-sm"
                >
                  <span className="truncate">
                    {m.home_team?.name} <b>{m.home_score}</b> : <b>{m.away_score}</b> {m.away_team?.name}
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Popup ad toggle */}
      <div className="card">
        <PopupAdToggle initialEnabled={popup.enabled} />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber" | "purple";
  href: string;
}) {
  const tones = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
  } as const;
  return (
    <Link
      href={href}
      className={`flex flex-col items-start justify-between gap-2 p-3 rounded-xl text-white bg-gradient-to-br ${tones[tone]} hover:opacity-90 transition`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="opacity-90">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <span className="text-3xl font-black tabular-nums">{value}</span>
    </Link>
  );
}
