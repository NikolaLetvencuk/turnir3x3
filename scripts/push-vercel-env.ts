import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const txt = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

const SKIP = new Set(["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID", "GITHUB_TOKEN"]);

async function pushOne(key: string, value: string, env: "production" | "preview" | "development", token: string): Promise<void> {
  // Try add first; on failure (already exists), remove then add
  const cmd = ["vercel", "env", "add", key, env, "--token", token];
  const proc = spawn("npx", cmd, { stdio: ["pipe", "inherit", "inherit"], shell: true });
  proc.stdin.write(value + "\n");
  proc.stdin.end();
  await new Promise<void>((resolve) => proc.on("close", () => resolve()));
}

async function removeOne(key: string, env: "production" | "preview" | "development", token: string): Promise<void> {
  const proc = spawn("npx", ["vercel", "env", "rm", key, env, "-y", "--token", token], { stdio: "inherit", shell: true });
  await new Promise<void>((resolve) => proc.on("close", () => resolve()));
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) { console.error("VERCEL_TOKEN required"); process.exit(1); }
  const env = readEnvFile(join(process.cwd(), ".env.local"));
  for (const [k, v] of Object.entries(env)) {
    if (SKIP.has(k)) continue;
    if (!v) continue;
    console.log(`Pushing ${k} ...`);
    // best-effort remove then add for idempotency
    await removeOne(k, "production", token);
    await pushOne(k, v, "production", token);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
