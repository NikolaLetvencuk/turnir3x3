import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const txt = readFileSync(path, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

type Team = {
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  players: string[];
};

// 20 famous 2015-era clubs with their star trio from that calendar year.
const TEAMS: Team[] = [
  { name: "Real Madrid", short_name: "RMA", primary_color: "#FFFFFF", secondary_color: "#FEBE10",
    players: ["Cristiano Ronaldo", "Karim Benzema", "Gareth Bale"] },
  { name: "Barcelona", short_name: "BAR", primary_color: "#A50044", secondary_color: "#004D98",
    players: ["Lionel Messi", "Luis Suárez", "Neymar Jr."] },
  { name: "Bayern Munich", short_name: "BAY", primary_color: "#DC052D", secondary_color: "#FFFFFF",
    players: ["Robert Lewandowski", "Thomas Müller", "Arjen Robben"] },
  { name: "Atletico Madrid", short_name: "ATM", primary_color: "#CB3524", secondary_color: "#FFFFFF",
    players: ["Antoine Griezmann", "Koke", "Fernando Torres"] },
  { name: "Juventus", short_name: "JUV", primary_color: "#000000", secondary_color: "#FFFFFF",
    players: ["Paul Pogba", "Paulo Dybala", "Mario Mandžukić"] },
  { name: "Manchester City", short_name: "MCI", primary_color: "#6CABDD", secondary_color: "#FFFFFF",
    players: ["Sergio Agüero", "David Silva", "Kevin De Bruyne"] },
  { name: "Manchester United", short_name: "MUN", primary_color: "#DA291C", secondary_color: "#FBE122",
    players: ["Wayne Rooney", "Anthony Martial", "Memphis Depay"] },
  { name: "Chelsea", short_name: "CHE", primary_color: "#034694", secondary_color: "#FFFFFF",
    players: ["Eden Hazard", "Diego Costa", "Cesc Fàbregas"] },
  { name: "Arsenal", short_name: "ARS", primary_color: "#EF0107", secondary_color: "#FFFFFF",
    players: ["Alexis Sánchez", "Mesut Özil", "Olivier Giroud"] },
  { name: "Liverpool", short_name: "LIV", primary_color: "#C8102E", secondary_color: "#00B2A9",
    players: ["Philippe Coutinho", "Daniel Sturridge", "Roberto Firmino"] },
  { name: "Paris Saint-Germain", short_name: "PSG", primary_color: "#004170", secondary_color: "#DA291C",
    players: ["Zlatan Ibrahimović", "Edinson Cavani", "Ángel Di María"] },
  { name: "Borussia Dortmund", short_name: "BVB", primary_color: "#FDE100", secondary_color: "#000000",
    players: ["Pierre-Emerick Aubameyang", "Marco Reus", "Henrikh Mkhitaryan"] },
  { name: "Tottenham", short_name: "TOT", primary_color: "#FFFFFF", secondary_color: "#132257",
    players: ["Harry Kane", "Christian Eriksen", "Dele Alli"] },
  { name: "Inter Milan", short_name: "INT", primary_color: "#0068A8", secondary_color: "#000000",
    players: ["Mauro Icardi", "Stevan Jovetić", "Geoffrey Kondogbia"] },
  { name: "AC Milan", short_name: "MIL", primary_color: "#FB090B", secondary_color: "#000000",
    players: ["Carlos Bacca", "Jérémy Ménez", "Keisuke Honda"] },
  { name: "AS Roma", short_name: "ROM", primary_color: "#8E1B1B", secondary_color: "#F0BC42",
    players: ["Francesco Totti", "Mohamed Salah", "Miralem Pjanić"] },
  { name: "Napoli", short_name: "NAP", primary_color: "#12A0D7", secondary_color: "#FFFFFF",
    players: ["Gonzalo Higuaín", "Lorenzo Insigne", "Marek Hamšík"] },
  { name: "Sevilla", short_name: "SEV", primary_color: "#FFFFFF", secondary_color: "#D72027",
    players: ["Kevin Gameiro", "Ever Banega", "Yevhen Konoplyanka"] },
  { name: "Crvena Zvezda", short_name: "CZV", primary_color: "#ED1C24", secondary_color: "#FFFFFF",
    players: ["Aleksandar Katai", "Filip Mladenović", "Luka Milunović"] },
  { name: "Partizan", short_name: "PAR", primary_color: "#000000", secondary_color: "#FFFFFF",
    players: ["Andrija Živković", "Petar Đuričković", "Nikola Antić"] },
];

async function main() {
  const force = process.argv.includes("--force") || process.argv.includes("--yes");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Backing up player photos by name…");
  const { data: existingPlayers } = await supabase
    .from("players")
    .select("name, photo_url")
    .not("photo_url", "is", null);
  const photoBackup = new Map<string, string>();
  for (const p of (existingPlayers ?? []) as Array<{ name: string; photo_url: string | null }>) {
    if (p.photo_url) photoBackup.set(p.name, p.photo_url);
  }
  console.log(`  ${photoBackup.size} photo(s) backed up`);

  const { count } = await supabase.from("teams").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    if (!force) {
      console.error(`❌ Postoji ${count} timova u bazi. Pokreni sa --force za reset + reseed.`);
      process.exit(1);
    }
    console.log("Resetting tournament data via reset_tournament_data()…");
    const { error: resetErr } = await supabase.rpc("reset_tournament_data");
    if (resetErr) {
      console.error(`❌ reset failed: ${resetErr.message}`);
      process.exit(1);
    }
  }

  let teamsInserted = 0;
  let playersInserted = 0;
  let photosRestored = 0;

  for (const team of TEAMS) {
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
      console.error(`❌ team ${team.name}: ${teamErr?.message ?? "unknown"}`);
      process.exit(1);
    }
    teamsInserted++;

    const rows = team.players.map((name) => {
      const photo_url = photoBackup.get(name) ?? null;
      if (photo_url) photosRestored++;
      return { name, team_id: (teamRow as any).id, photo_url };
    });
    const { error: pErr } = await supabase.from("players").insert(rows);
    if (pErr) {
      console.error(`❌ players ${team.name}: ${pErr.message}`);
      process.exit(1);
    }
    playersInserted += rows.length;
    console.log(`  ✓ ${team.name} (${team.short_name}) — ${team.players.length} igrača`);
  }

  console.log(`\n🎉 Gotovo: ${teamsInserted} timova, ${playersInserted} igrača`);
  if (photosRestored > 0) console.log(`📸 ${photosRestored} slika restaurirano po imenu`);
  console.log("\nSledeći koraci:");
  console.log("  1. Otvori /admin/draw");
  console.log("  2. Postavi broj grupa (npr. 4 grupe × 5 timova ili 5 × 4)");
  console.log("  3. Pokreni žreb");
}

main().catch((e) => { console.error(e); process.exit(1); });
