import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFantasyOverview, getPlayersForPicker, getUserBudget } from "@/lib/fantasy";
import { TeamEditor } from "./TeamEditor";

export const revalidate = 0;

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team");
  const supabase = createClient();

  const [overview, picker, draftRes, lockedSnapRes, budgetInfo] = await Promise.all([
    getFantasyOverview(profile.id),
    getPlayersForPicker(),
    supabase.from("fantasy_teams").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("fantasy_team_snapshots").select("*").eq("user_id", profile.id),
    getUserBudget(profile.id),
  ]);

  const lockedForUpcoming = overview.next_round
    ? ((lockedSnapRes.data ?? []) as any[]).find((s) => s.round_id === overview.next_round!.id) ?? null
    : null;

  return (
    <TeamEditor
      overview={overview}
      draft={(draftRes.data as any) ?? null}
      lockedForUpcoming={lockedForUpcoming}
      players={picker}
      budget={budgetInfo.budget}
      bank={budgetInfo.bank}
    />
  );
}
