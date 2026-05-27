import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveEventEntry } from "./LiveEventEntry";

export const revalidate = 0;

export default async function LiveMatchPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: match }, { data: events }, { data: players }] = await Promise.all([
    supabase.from("matches").select("*, home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url), away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url), round:rounds(stage, name)").eq("id", params.id).maybeSingle(),
    supabase.from("match_events").select("*").eq("match_id", params.id).order("minute", { nullsFirst: true }).order("created_at"),
    supabase.from("players").select("id, name, team_id, photo_url"),
  ]);
  if (!match) notFound();

  return <LiveEventEntry matchInit={match as any} eventsInit={events ?? []} players={players ?? []} />;
}
