import { createAdminClient } from "@/lib/supabase/admin";
import { NewsAdmin, type CaptainTeam, type NewsRow } from "./NewsAdmin";

export const revalidate = 0;

type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

type CaptainRow = { team_id: string; name: string | null; phone: string | null };

type MatchRow = {
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string | null;
  status: string;
};

function belgradeDateKey(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return null;
  }
}

export default async function AdminNewsPage() {
  const admin = createAdminClient();
  const [{ data: news }, { data: teams }, { data: captains }, { data: matches }] = await Promise.all([
    admin.from("news").select("id, title, body, created_at").order("created_at", { ascending: false }),
    admin.from("teams").select("id, name, short_name, primary_color, secondary_color").order("name"),
    admin.from("team_captains").select("team_id, name, phone"),
    admin.from("matches").select("home_team_id, away_team_id, kickoff_at, status"),
  ]);

  const captainByTeam = new Map<string, CaptainRow>();
  for (const c of (captains ?? []) as CaptainRow[]) {
    captainByTeam.set(c.team_id, c);
  }

  // Compute "today's playing teams" set (Belgrade local date)
  const today = belgradeDateKey(new Date().toISOString());
  const todayTeamIds = new Set<string>();
  if (today) {
    for (const m of (matches ?? []) as MatchRow[]) {
      if (belgradeDateKey(m.kickoff_at) !== today) continue;
      if (m.home_team_id) todayTeamIds.add(m.home_team_id);
      if (m.away_team_id) todayTeamIds.add(m.away_team_id);
    }
  }

  const teamsList: CaptainTeam[] = ((teams ?? []) as TeamRow[]).map((t) => {
    const cap = captainByTeam.get(t.id);
    return {
      id: t.id,
      name: t.name,
      short_name: t.short_name,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      captain_name: cap?.name ?? null,
      captain_phone: cap?.phone ?? null,
      plays_today: todayTeamIds.has(t.id),
    };
  });

  const newsList: NewsRow[] = (news ?? []) as NewsRow[];

  return <NewsAdmin news={newsList} teams={teamsList} />;
}
