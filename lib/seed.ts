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
  {
    name: "Barselona",
    short_name: "BAR",
    primary_color: "#A50044",
    secondary_color: "#004D98",
    players: [
      "Lionel Messi",
      "Luis Suárez",
      "Neymar Jr.",
    ],
  },
  {
    name: "Real Madrid",
    short_name: "RMA",
    primary_color: "#FEBE10",
    secondary_color: "#FFFFFF",
    players: [
      "Cristiano Ronaldo",
      "Gareth Bale",
      "Karim Benzema",
    ],
  },
  {
    name: "Bajern Minhen",
    short_name: "BAJ",
    primary_color: "#DC052D",
    secondary_color: "#FFFFFF",
    players: [
      "Robert Lewandowski",
      "Arjen Robben",
      "Thomas Müller",
    ],
  },
  {
    name: "Atletiko Madrid",
    short_name: "ATM",
    primary_color: "#CB3524",
    secondary_color: "#272E61",
    players: [
      "Antoine Griezmann",
      "Fernando Torres",
      "Koke",
    ],
  },
];

export type SeedResult =
  | { ok: true; teamsInserted: number; playersInserted: number; photosRestored: number }
  | { ok: false; error: string };

/**
 * Seed demo data. If `force` is true and existing data is present:
 *   1. Backs up player photo_url's by name (resilient to UUID changes)
 *   2. Runs nuclear `reset_tournament_data` (Storage files are NOT touched)
 *   3. Re-inserts demo teams + players with restored photo_url where name matches
 *
 * Caller must pass a service-role Supabase client.
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
  const photoBackup = new Map<string, string>();

  if (existing > 0) {
    if (!force) {
      return { ok: false, error: `Postoji ${existing} timova. Pokreni sa force=true ili reset.` };
    }

    const { data: existingPlayers } = await supabase
      .from("players")
      .select("name, photo_url")
      .not("photo_url", "is", null);
    for (const p of (existingPlayers ?? []) as Array<{ name: string; photo_url: string | null }>) {
      if (p.photo_url) photoBackup.set(p.name, p.photo_url);
    }

    const { error: resetErr } = await supabase.rpc("reset_tournament_data");
    if (resetErr) return { ok: false, error: `reset: ${resetErr.message}` };
  }

  let teamsInserted = 0;
  let playersInserted = 0;
  let photosRestored = 0;
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
    const rows = team.players.map((name) => {
      const photo_url = photoBackup.get(name) ?? null;
      if (photo_url) photosRestored++;
      return { name, team_id: (teamRow as any).id, photo_url };
    });
    if (rows.length) {
      const { error: pErr } = await supabase.from("players").insert(rows);
      if (pErr) return { ok: false, error: `players ${team.name}: ${pErr.message}` };
      playersInserted += rows.length;
    }
  }

  return { ok: true, teamsInserted, playersInserted, photosRestored };
}
