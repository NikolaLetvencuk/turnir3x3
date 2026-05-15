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
  const force = process.argv.includes("--force") || process.argv.includes("--yes");
  if (!force) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("Type RESET to confirm full database wipe: ");
    rl.close();
    if (answer.trim() !== "RESET") { console.log("Aborted."); process.exit(0); }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminEmail = process.env.ADMIN_EMAIL!;
  if (!url || !key || !adminEmail) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ADMIN_EMAIL");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: dbErr } = await supabase.rpc("reset_tournament_data");
  if (dbErr) { console.error("DB reset failed:", dbErr.message); process.exit(1); }
  console.log("✓ Tournament data wiped");

  const { data: usersList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const u of usersList?.users ?? []) {
    if (u.email !== adminEmail) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
  console.log("✓ Non-admin users wiped");

  try {
    const { data: top } = await supabase.storage.from("player-photos").list("", { limit: 10000 });
    const paths: string[] = [];
    for (const entry of top ?? []) {
      if (!entry.name) continue;
      const { data: inner } = await supabase.storage.from("player-photos").list(entry.name, { limit: 1000 });
      for (const f of inner ?? []) paths.push(`${entry.name}/${f.name}`);
    }
    if (paths.length) await supabase.storage.from("player-photos").remove(paths);
    console.log(`✓ Player photos wiped (${paths.length} files)`);
  } catch {
    console.log("✓ Player photos bucket not present yet — skipped");
  }

  const { data: postList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const admin = postList?.users.find((u) => u.email === adminEmail);
  if (admin) {
    await supabase.from("profiles").upsert({ id: admin.id, email: adminEmail, role: "admin" });
    console.log("✓ Admin profile verified");
  } else {
    console.log("⚠ Admin user missing — run npm run seed:admin");
  }

  console.log("\n🎉 Database reset complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
