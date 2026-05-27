import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}

export default async function HistoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team/history");

  const admin = createAdminClient();
  const [{ data: picks }, { data: pts }, { data: players }] = await Promise.all([
    (admin as any)
      .from("fantasy_day_picks")
      .select("day, player1_id, player2_id, player3_id")
      .eq("user_id", profile.id)
      .order("day", { ascending: false }),
    (admin as any)
      .from("fantasy_day_points")
      .select("day, player1_points, player2_points, player3_points, total_points")
      .eq("user_id", profile.id),
    admin.from("players").select("id, name"),
  ]);

  const playerMap = new Map(((players ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
  const ptsMap = new Map<string, any>();
  for (const r of (pts ?? []) as any[]) ptsMap.set(r.day, r);
  const total = (pts ?? []).reduce((a: number, b: any) => a + (b.total_points ?? 0), 0);
  const rows = (picks ?? []) as Array<{ day: string; player1_id: string; player2_id: string; player3_id: string }>;

  return (
    <div className="space-y-4">
      <div className="card flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Moja istorija</h1>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Ukupno bodova</div>
          <div className="text-2xl font-bold tabular-nums">{total}</div>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const p = ptsMap.get(r.day);
          const slotPts = [p?.player1_points ?? 0, p?.player2_points ?? 0, p?.player3_points ?? 0];
          return (
            <Link
              key={r.day}
              href={`/fantasy/team?day=${r.day}`}
              className="card block hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-medium">{formatSrDate(r.day)}</h2>
                <span className="font-bold tabular-nums">{p?.total_points ?? "—"}</span>
              </div>
              <div className="space-y-1 text-sm">
                {[r.player1_id, r.player2_id, r.player3_id].map((pid, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>{playerMap.get(pid) ?? "?"}</span>
                    <span className="text-zinc-500 text-xs">
                      <b className="text-zinc-100">{slotPts[i]}</b>
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-zinc-500">Još nemaš sačuvane timove. Idi na <Link href="/fantasy/team" className="text-blue-300 underline">Sastavi tim</Link>.</p>
        )}
      </div>
    </div>
  );
}
