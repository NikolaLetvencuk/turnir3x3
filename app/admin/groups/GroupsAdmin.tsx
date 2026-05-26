"use client";

import { Users } from "lucide-react";
import { useActionRunner } from "@/components/admin/FormButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { createGroup, deleteGroup, setTeamGroup } from "../actions";

type Group = { id: string; name: string; display_order: number };
type Team = { id: string; name: string };

export function GroupsAdmin({ groups, teams, assignment }: { groups: Group[]; teams: Team[]; assignment: Record<string, string> }) {
  const run = useActionRunner();

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createGroup, fd);
    if (ok) e.currentTarget.reset();
  }

  async function onAssign(team_id: string, group_id: string) {
    const fd = new FormData(); fd.set("team_id", team_id); fd.set("group_id", group_id);
    await run(setTeamGroup, fd, { successMessage: "Promenjeno" });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="Grupe"
        hint="Ručno raspoređivanje timova u grupe. Većini turnira ne treba ovde — koristi sekciju Žreb."
        tone="blue"
      />
      <form onSubmit={onCreate} className="card grid sm:grid-cols-[1fr_auto_auto] gap-2">
        <input name="name" placeholder="Naziv (npr. Grupa A)" required className="input" />
        <input name="display_order" type="number" defaultValue={groups.length} className="input w-24" />
        <button className="btn-primary">Dodaj grupu</button>
      </form>

      <div className="grid sm:grid-cols-2 gap-3">
        {groups.map((g) => (
          <div key={g.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">{g.name}</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!confirm(`Obrisati ${g.name}?`)) return;
                const fd = new FormData(); fd.set("id", g.id);
                await run(deleteGroup, fd, { successMessage: "Obrisano" });
              }}>
                <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
              </form>
            </div>
            <ul className="text-sm space-y-1">
              {teams.filter((t) => assignment[t.id] === g.id).map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span>{t.name}</span>
                  <button className="text-xs text-red-600 hover:underline" onClick={() => onAssign(t.id, "")}>ukloni</button>
                </li>
              ))}
              {teams.filter((t) => assignment[t.id] === g.id).length === 0 && <li className="text-zinc-400">— prazno —</li>}
            </ul>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-medium mb-2">Dodeli timove grupama</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Tim</th><th className="text-left">Grupa</th></tr></thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-t border-zinc-800">
                <td className="py-2">{t.name}</td>
                <td>
                  <select className="input" defaultValue={assignment[t.id] ?? ""} onChange={(e) => onAssign(t.id, e.target.value)}>
                    <option value="">—</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
