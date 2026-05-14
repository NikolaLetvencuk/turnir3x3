import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveMatchView } from "./LiveMatchView";

export const revalidate = 0;

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: match }, { data: events }, { data: players }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), round:rounds(name)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("match_events")
      .select("*")
      .eq("match_id", params.id)
      .order("minute", { ascending: true, nullsFirst: true })
      .order("created_at"),
    supabase.from("players").select("id, name, team_id"),
  ]);

  if (!match) notFound();

  return (
    <LiveMatchView
      matchInit={match as any}
      eventsInit={events ?? []}
      players={players ?? []}
    />
  );
}
