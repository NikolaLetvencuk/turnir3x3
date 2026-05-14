import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { TeamEditor } from "./TeamEditor";

export const revalidate = 0;

export default async function TeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team");
  const supabase = createClient();

  const [playersRes, teamsRes, pricesRes, roundsRes, mineRes, transfersRes] = await Promise.all([
    supabase.from("players").select("id, name, team_id").order("name"),
    supabase.from("teams").select("id, name"),
    supabase.from("player_prices").select("player_id, price, round_id, round:rounds(display_order)"),
    supabase.from("rounds").select("id, name, status, display_order").order("display_order"),
    supabase.from("fantasy_teams").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("player_transfers").select("round_id"),
  ]);
  const players = (playersRes.data ?? []) as Array<{ id: string; name: string; team_id: string | null }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string }>;
  const prices = (pricesRes.data ?? []) as any[];
  const rounds = (roundsRes.data ?? []) as Array<{ id: string; name: string; status: string; display_order: number }>;
  const mine = mineRes.data as any;
  const transfers = (transfersRes.data ?? []) as Array<{ round_id: string | null }>;

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    const id = p.player_id;
    const order = p.round?.display_order ?? 0;
    const prevOrder = priceMap.get(`${id}_o`);
    if (prevOrder === undefined || prevOrder < order) {
      priceMap.set(id, Number(p.price));
      priceMap.set(`${id}_o`, order);
    }
  }
  const playersWithPrice = players.map((p) => ({
    id: p.id,
    name: p.name,
    team_id: p.team_id,
    team_name: p.team_id ? teamMap.get(p.team_id) ?? null : null,
    price: priceMap.get(p.id) ?? 10.0,
  }));

  const activeRound = rounds.find((r) => r.status === "active");
  const nextUpcoming = rounds.find((r) => r.status === "upcoming");
  const transfersThisRound = nextUpcoming
    ? transfers.filter((t) => t.round_id === nextUpcoming.id).length
    : 0;

  return (
    <TeamEditor
      userId={profile.id}
      players={playersWithPrice}
      mine={mine ?? null}
      activeRound={activeRound ?? null}
      nextRound={nextUpcoming ?? null}
      transfersThisRound={transfersThisRound}
    />
  );
}
