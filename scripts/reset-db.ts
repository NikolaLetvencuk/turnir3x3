import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

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
  const full = process.argv.includes("--full");
  const yes = process.argv.includes("--yes") || process.argv.includes("--force");

  const mode = full ? "FULL" : "PROGRESS";
  const description = full
    ? "OBRISATI SVE uključujući timove, igrače, slike, auth korisnike"
    : "obrisati mečeve/događaje/žreb/fantasy, ZADRŽATI timove/igrače/slike";

  if (!yes) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`Ovo će ${description}.\nUkucaj ${mode} da potvrdiš: `);
    rl.close();
    if (answer.trim() !== mode) { console.log("Aborted."); process.exit(0); }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminEmail = process.env.ADMIN_EMAIL!;
  if (!url || !key || !adminEmail) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_EMAIL");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (full) {
    const { error } = await supabase.rpc("reset_tournament_data");
    if (error) { console.error("DB reset failed:", error.message); process.exit(1); }
    console.log("✓ Sve obrisano (timovi, igrači, mečevi)");

    // Wipe storage
    try {
      const { data: top } = await supabase.storage.from("player-photos").list("", { limit: 10000 });
      const paths: string[] = [];
      for (const entry of top ?? []) {
        if (!entry.name) continue;
        const { data: inner } = await supabase.storage.from("player-photos").list(entry.name, { limit: 1000 });
        for (const f of inner ?? []) paths.push(`${entry.name}/${f.name}`);
      }
      if (paths.length) await supabase.storage.from("player-photos").remove(paths);
      console.log(`✓ Storage obrisan (${paths.length} fajlova)`);
    } catch {
      console.log("✓ Storage bucket nije prisutan");
    }
  } else {
    const { error } = await supabase.rpc("reset_tournament_progress");
    if (error) { console.error("Soft reset failed:", error.message); process.exit(1); }
    console.log("✓ Turnir resetovan (timovi, igrači i slike zadržani)");
  }

  // Always wipe non-admin auth users
  const { data: usersList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let removed = 0;
  for (const u of usersList?.users ?? []) {
    if (u.email !== adminEmail) {
      await supabase.auth.admin.deleteUser(u.id);
      removed++;
    }
  }
  console.log(`✓ Obrisano ${removed} test korisnika`);

  // Re-verify admin profile
  const { data: postList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const admin = postList?.users.find((u) => u.email === adminEmail);
  if (admin) {
    await supabase.from("profiles").upsert({ id: admin.id, email: adminEmail, role: "admin" });
    console.log("✓ Admin profil verifikovan");
  }

  console.log(`\n🎉 ${full ? "Potpuni" : "Soft"} reset gotov.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
