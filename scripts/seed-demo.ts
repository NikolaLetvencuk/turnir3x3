import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DEMO_DATA, seedDemoData } from "../lib/seed";

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

async function main() {
  const force = process.argv.includes("--force") || process.argv.includes("--full");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Seeding demo data...");
  const res = await seedDemoData(supabase, force);
  if (!res.ok) {
    if (res.error.startsWith("Postoji")) {
      console.error(`❌ ${res.error}\nKoristi --force za reset + seed.`);
    } else {
      console.error(`❌ ${res.error}`);
    }
    process.exit(1);
  }

  for (const team of DEMO_DATA) {
    console.log(`✓ ${team.name} (${team.players.length} igrača)`);
  }
  console.log(`\n🎉 Demo seed gotov: ${res.teamsInserted} timova, ${res.playersInserted} igrača`);
  if (res.photosRestored > 0) {
    console.log(`📸 ${res.photosRestored} slika igrača restaurirano po imenu`);
  }
  console.log("\nSledeći koraci:");
  console.log("  1. Otvori /admin/draw u browseru");
  console.log("  2. Izaberi 2 grupe (za 4 tima → 2 po grupi)");
  console.log("  3. Pokreni žreb");
}

main().catch((e) => { console.error(e); process.exit(1); });
