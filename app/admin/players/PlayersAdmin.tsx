"use client";

import { useMemo, useState } from "react";
import { Search, User, Pencil, Trash2, X } from "lucide-react";
import { useActionRunner } from "@/components/admin/FormButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PageHeader } from "@/components/admin/PageHeader";
import { createPlayer, deletePlayer, removePlayerPhoto, updatePlayer, uploadPlayerPhoto } from "../actions";

type Player = { id: string; name: string; team_id: string | null; photo_url: string | null };
type Team = { id: string; name: string; primary_color: string | null };

async function resizeToJpeg(file: File, maxSize = 400, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nije podržan");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Konverzija nije uspela"))),
      "image/jpeg",
      quality,
    );
  });
}

function PhotoUploader({ playerId, hasPhoto, run }: { playerId: string; hasPhoto: boolean; run: ReturnType<typeof useActionRunner> }) {
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const blob = await resizeToJpeg(f);
      const fd = new FormData();
      fd.set("player_id", playerId);
      fd.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      await run(uploadPlayerPhoto, fd, { successMessage: "Slika sačuvana" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onRemove() {
    if (!confirm("Obrisati sliku?")) return;
    const fd = new FormData(); fd.set("player_id", playerId);
    await run(removePlayerPhoto, fd, { successMessage: "Obrisano" });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="btn-secondary !py-1 !px-2 text-xs cursor-pointer">
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        {busy ? "..." : hasPhoto ? "Promeni" : "Slika"}
      </label>
      {hasPhoto && (
        <button onClick={onRemove} className="btn-secondary !py-1 !px-2 text-xs">×</button>
      )}
    </div>
  );
}

export function PlayersAdmin({ players, teams }: { players: Player[]; teams: Team[] }) {
  const run = useActionRunner();
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (teamFilter === "__none__" ? p.team_id : teamFilter ? p.team_id !== teamFilter : false) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [players, search, teamFilter]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createPlayer, fd);
    if (ok) e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={User}
        title="Igrači"
        hint="Unesi svakog igrača i poveži ga sa njegovim timom. Slika je opciona."
        tone="emerald"
      />
      <form onSubmit={onCreate} className="card space-y-2">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Dodaj igrača</div>
        <div className="grid sm:grid-cols-[1.5fr_1fr_auto] gap-2">
          <input name="name" placeholder="Ime i prezime" required className="input" />
          <select name="team_id" className="input" required>
            <option value="">— Izaberi tim —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn-primary">+ Dodaj</button>
        </div>
      </form>
      <div className="card space-y-2">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži igrače po imenu…"
              className="input !pl-9"
            />
          </div>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="input sm:w-auto"
          >
            <option value="">Svi timovi ({players.length})</option>
            {teams.map((t) => {
              const c = players.filter((p) => p.team_id === t.id).length;
              return (
                <option key={t.id} value={t.id}>
                  {t.name} ({c})
                </option>
              );
            })}
            {players.some((p) => !p.team_id) && (
              <option value="__none__">Bez tima ({players.filter((p) => !p.team_id).length})</option>
            )}
          </select>
        </div>
        {(search || teamFilter) && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>
              Prikazano <b>{filteredPlayers.length}</b> od {players.length}
            </span>
            <button
              onClick={() => {
                setSearch("");
                setTeamFilter("");
              }}
              className="inline-flex items-center gap-1 text-blue-300 hover:underline"
            >
              <X className="w-3 h-3" /> Poništi filtere
            </button>
          </div>
        )}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2 w-12"></th><th className="text-left">Ime</th><th className="text-left">Tim</th><th></th></tr></thead>
          <tbody>
            {filteredPlayers.map((p) => (
              <tr key={p.id} className="border-t border-zinc-800">
                {editing === p.id ? (
                  <td colSpan={4} className="py-2">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", p.id);
                      const ok = await run(updatePlayer, fd);
                      if (ok) setEditing(null);
                    }} className="grid grid-cols-[1.5fr_1fr_auto_auto] gap-2">
                      <input name="name" defaultValue={p.name} className="input" />
                      <select name="team_id" defaultValue={p.team_id ?? ""} className="input">
                        <option value="">—</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button className="btn-primary">Sačuvaj</button>
                      <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Otkaži</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="py-2">
                      <PlayerAvatar name={p.name} photoUrl={p.photo_url} teamPrimary={p.team_id ? teamMap.get(p.team_id)?.primary_color : null} size={36} />
                    </td>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-zinc-500">{p.team_id ? teamMap.get(p.team_id)?.name : "—"}</td>
                    <td className="text-right space-x-1 whitespace-nowrap">
                      <PhotoUploader playerId={p.id} hasPhoto={!!p.photo_url} run={run} />
                      <button
                        onClick={() => setEditing(p.id)}
                        className="inline-flex items-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1.5"
                        aria-label="Izmeni"
                        title="Izmeni"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <form className="inline" onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirm(`Obrisati igrača „${p.name}"?`)) return;
                        const fd = new FormData(); fd.set("id", p.id);
                        await run(deletePlayer, fd, { successMessage: "Obrisano" });
                      }}>
                        <button
                          className="inline-flex items-center rounded-md bg-red-50 hover:bg-red-100 text-red-700 p-1.5"
                          aria-label="Obriši"
                          title="Obriši"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filteredPlayers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-500 text-sm">
                  {players.length === 0
                    ? "Još nema igrača. Popuni formu iznad."
                    : "Nema igrača za izabrane filtere."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
