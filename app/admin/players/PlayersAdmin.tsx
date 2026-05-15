"use client";

import { useState } from "react";
import { useActionRunner } from "@/components/admin/FormButton";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { createPlayer, deletePlayer, removePlayerPhoto, updatePlayer, uploadPlayerPhoto } from "../actions";

type Player = { id: string; name: string; team_id: string | null; position: string | null; photo_url: string | null };
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
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createPlayer, fd);
    if (ok) e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Igrači</h1>
      <form onSubmit={onCreate} className="card grid sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-2">
        <input name="name" placeholder="Ime i prezime" required className="input" />
        <select name="team_id" className="input">
          <option value="">— bez tima —</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input name="position" placeholder="Pozicija (opciono)" className="input" />
        <button className="btn-primary">Dodaj</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2 w-12"></th><th className="text-left">Ime</th><th className="text-left">Tim</th><th className="text-left">Pozicija</th><th></th></tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                {editing === p.id ? (
                  <td colSpan={5} className="py-2">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      fd.set("id", p.id);
                      const ok = await run(updatePlayer, fd);
                      if (ok) setEditing(null);
                    }} className="grid grid-cols-[1.5fr_1fr_1fr_auto_auto] gap-2">
                      <input name="name" defaultValue={p.name} className="input" />
                      <select name="team_id" defaultValue={p.team_id ?? ""} className="input">
                        <option value="">—</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input name="position" defaultValue={p.position ?? ""} className="input" />
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
                    <td className="text-zinc-500">{p.position ?? "—"}</td>
                    <td className="text-right space-x-1 whitespace-nowrap">
                      <PhotoUploader playerId={p.id} hasPhoto={!!p.photo_url} run={run} />
                      <button onClick={() => setEditing(p.id)} className="btn-secondary !py-1 !px-2 text-xs">Izmeni</button>
                      <form className="inline" onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirm(`Obrisati igrača „${p.name}"?`)) return;
                        const fd = new FormData(); fd.set("id", p.id);
                        await run(deletePlayer, fd, { successMessage: "Obrisano" });
                      }}>
                        <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
                      </form>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {players.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Nema igrača.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
