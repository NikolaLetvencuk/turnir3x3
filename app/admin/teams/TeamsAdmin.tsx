"use client";

import { useState } from "react";
import { useActionRunner } from "@/components/admin/FormButton";
import { createTeam, updateTeam, deleteTeam } from "../actions";

type Team = { id: string; name: string; short_name: string | null };

export function TeamsAdmin({ teams }: { teams: Team[] }) {
  const run = useActionRunner();
  const [editing, setEditing] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createTeam, fd);
    if (ok) e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Timovi</h1>
      <form onSubmit={onCreate} className="card grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input name="name" placeholder="Naziv tima" required className="input" />
        <input name="short_name" placeholder="Skraćeno" className="input" />
        <button className="btn-primary">Dodaj</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Naziv</th><th className="text-left">Skraćeno</th><th></th></tr></thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100">
                {editing === t.id ? (
                  <td colSpan={3} className="py-2">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", t.id);
                      const ok = await run(updateTeam, fd);
                      if (ok) setEditing(null);
                    }} className="flex gap-2">
                      <input name="name" defaultValue={t.name} className="input" />
                      <input name="short_name" defaultValue={t.short_name ?? ""} className="input" />
                      <button className="btn-primary">Sačuvaj</button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Otkaži</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="py-2 font-medium">{t.name}</td>
                    <td className="text-zinc-500">{t.short_name ?? "—"}</td>
                    <td className="text-right space-x-1">
                      <button onClick={() => setEditing(t.id)} className="btn-secondary !py-1 !px-2 text-xs">Izmeni</button>
                      <form className="inline" onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirm(`Obrisati tim "${t.name}"?`)) return;
                        const fd = new FormData(); fd.set("id", t.id);
                        await run(deleteTeam, fd, { successMessage: "Obrisano" });
                      }}>
                        <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
                      </form>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {teams.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-zinc-500">Nema timova.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
