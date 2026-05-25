import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SendNewsClient, type SendTarget } from "./SendNewsClient";

export const revalidate = 0;

export default async function SendNewsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { teams?: string };
}) {
  const admin = createAdminClient();
  const teamIds = (searchParams.teams ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [{ data: news }, { data: teams }, { data: captains }] = await Promise.all([
    admin.from("news").select("id, title, body, created_at").eq("id", params.id).maybeSingle(),
    teamIds.length > 0
      ? admin.from("teams").select("id, name, short_name, primary_color, secondary_color").in("id", teamIds)
      : Promise.resolve({ data: [] as any[] }),
    teamIds.length > 0
      ? admin.from("team_captains").select("team_id, name, phone").in("team_id", teamIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  if (!news) notFound();

  const captainByTeam = new Map<string, { name: string | null; phone: string | null }>();
  for (const c of (captains ?? []) as Array<{ team_id: string; name: string | null; phone: string | null }>) {
    captainByTeam.set(c.team_id, c);
  }

  const targets: SendTarget[] = ((teams ?? []) as any[])
    .map((t) => {
      const cap = captainByTeam.get(t.id);
      return {
        team_id: t.id,
        team_name: t.name,
        team_short: t.short_name,
        team_primary: t.primary_color,
        team_secondary: t.secondary_color,
        captain_name: cap?.name ?? null,
        captain_phone: cap?.phone ?? null,
      };
    })
    .filter((t) => t.captain_phone);

  return (
    <div className="space-y-4">
      <Link href="/admin/news" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-blue-700">
        <ArrowLeft className="w-4 h-4" /> Nazad na vesti
      </Link>
      <SendNewsClient
        title={(news as any).title}
        body={(news as any).body}
        targets={targets}
      />
    </div>
  );
}
