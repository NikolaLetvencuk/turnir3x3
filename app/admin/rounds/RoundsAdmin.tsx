"use client";

import { useActionRunner } from "@/components/admin/FormButton";
import { activateRound, createRound, deleteRound, updateRound } from "../actions";
import { formatDateTime } from "@/lib/utils";

type Round = { id: string; name: string; stage: string; display_order: number; status: string; starts_at: string | null };

export function RoundsAdmin({ rounds }: { rounds: Round[] }) {
  const run = useActionRunner();

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createRound, fd);
    if (ok) e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Kola turnira</h1>
      <form onSubmit={onCreate} className="card grid sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2">
        <input name="name" placeholder="Naziv (npr. Kolo 1)" required className="input" />
        <select name="stage" className="input" defaultValue="group">
          <option value="group">Grupna faza</option>
          <option value="knockout">Eliminacije</option>
        </select>
        <input name="display_order" type="number" defaultValue={rounds.length} className="input" />
        <input name="starts_at" type="datetime-local" className="input" />
        <button className="btn-primary">Dodaj</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Naziv</th><th className="text-left">Faza</th><th className="text-left">Status</th><th className="text-left">Start</th><th></th></tr></thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="py-2 font-medium">{r.name}</td>
                <td>{r.stage === "group" ? "Grupna" : "Eliminacije"}</td>
                <td>
                  {r.status === "active" && <span className="badge-live"><span className="live-dot" />aktivno</span>}
                  {r.status === "finished" && <span className="badge-finished">završeno</span>}
                  {r.status === "upcoming" && <span className="badge-scheduled">predstoji</span>}
                </td>
                <td className="text-zinc-500">{formatDateTime(r.starts_at)}</td>
                <td className="text-right space-x-1">
                  {r.status === "upcoming" && (
                    <form className="inline" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!confirm(`Aktivirati ${r.name}? Snapshotovaće sve trenutne timove.`)) return;
                      const fd = new FormData(); fd.set("id", r.id);
                      await run(activateRound, fd, { successMessage: "Aktivirano" });
                    }}>
                      <button className="btn-primary !py-1 !px-2 text-xs">Aktiviraj</button>
                    </form>
                  )}
                  <form className="inline" onSubmit={async (e) => {
                    e.preventDefault();
                    if (!confirm(`Obrisati ${r.name}?`)) return;
                    const fd = new FormData(); fd.set("id", r.id);
                    await run(deleteRound, fd, { successMessage: "Obrisano" });
                  }}>
                    <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
                  </form>
                </td>
              </tr>
            ))}
            {rounds.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Nema kola.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
