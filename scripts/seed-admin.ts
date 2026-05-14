import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Tiny inline dotenv (avoid extra dep): read .env.local if present
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  if (!url || !serviceKey || !email || !password) {
    console.error("Missing required env vars");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let userId: string | null = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (created?.user) {
    userId = created.user.id;
    console.log("Created admin user:", email);
  } else if (createErr) {
    if (/already.*registered|exists/i.test(createErr.message)) {
      // Fetch existing by listing
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const u = list.users.find((x) => x.email === email);
      if (!u) { console.error("Could not find existing admin user"); process.exit(1); }
      userId = u.id;
      console.log("Admin user exists:", email);
    } else {
      console.error("createUser error:", createErr.message);
      process.exit(1);
    }
  }
  if (!userId) { console.error("No user id"); process.exit(1); }

  const { error: upErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, email, role: "admin" }, { onConflict: "id" });
  if (upErr) { console.error("upsert profile error:", upErr.message); process.exit(1); }

  console.log("Admin profile ready (role=admin).");
}

main().catch((e) => { console.error(e); process.exit(1); });
