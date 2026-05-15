import type { SupabaseClient } from "@supabase/supabase-js";

export type DemoTeam = {
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  players: string[];
};

export const DEMO_DATA: DemoTeam[] = [
  {
    name: "Njukasl",
    short_name: "NJK",
    primary_color: "#000000",
    secondary_color: "#FFFFFF",
    players: [
      "Miloš Ničetin",
      "Vukašin Patković",
      "Uroš Sisarica",
      "Nikola Letvenčuk",
    ],
  },
  {
    name: "Juventus",
    short_name: "JUV",
    primary_color: "#FFFFFF",
    secondary_color: "#000000",
    players: [
      "Mario Mandžukić",
      "Miralem Pjanić",
      "Marko Pjaca",
    ],
  },
  {
    name: "La Familia",
    short_name: "LAF",
    primary_color: "#1E40AF",
    secondary_color: "#000000",
    players: [
      "Stefan Hardi 1",
      "Stefan Hardi 2",
      "Stefan Hardi 3",
    ],
  },
  {
    name: "Jasike",
    short_name: "JAS",
    primary_color: "#15803D",
    secondary_color: "#FFFFFF",
    players: [
      "Čelavi Šmarac 1",
      "Čelavi Šmarac 2",
      "Čelavi Šmarac 3",
    ],
  },
];

export type SeedResult =
  | { ok: true; teamsInserted: number; playersInserted: number }
  | { ok: false; error: string };

/**
 * Seed demo data. If `force` is true and existing data is present, runs reset_tournament_data first.
 * If `force` is false and data exists, returns an error.
 *
 * Caller must pass a service-role Supabase client. Authorization is the caller's responsibility.
 */
export async function seedDemoData(
  supabase: SupabaseClient,
  force: boolean,
): Promise<SeedResult> {
  const { count, error: countErr } = await supabase
    .from("teams")
    .select("*", { count: "exact", head: true });
  if (countErr) return { ok: false, error: `count teams: ${countErr.message}` };

  const existing = count ?? 0;
  if (existing > 0 && !force) {
    return { ok: false, error: `Postoji ${existing} timova. Pokreni sa force=true ili reset.` };
  }
  if (existing > 0 && force) {
    const { error: resetErr } = await supabase.rpc("reset_tournament_data");
    if (resetErr) return { ok: false, error: `reset: ${resetErr.message}` };
  }

  let teamsInserted = 0;
  let playersInserted = 0;
  for (const team of DEMO_DATA) {
    const { data: teamRow, error: teamErr } = await supabase
      .from("teams")
      .insert({
        name: team.name,
        short_name: team.short_name,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
      })
      .select("id")
      .single();
    if (teamErr || !teamRow) {
      return { ok: false, error: `team ${team.name}: ${teamErr?.message ?? "unknown"}` };
    }
    teamsInserted++;
    const rows = team.players.map((name) => ({ name, team_id: (teamRow as any).id }));
    if (rows.length) {
      const { error: pErr } = await supabase.from("players").insert(rows);
      if (pErr) return { ok: false, error: `players ${team.name}: ${pErr.message}` };
      playersInserted += rows.length;
    }
  }

  return { ok: true, teamsInserted, playersInserted };
}
