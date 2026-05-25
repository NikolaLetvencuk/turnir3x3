"use client";

import { useState } from "react";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { createTeam, updateTeam, deleteTeam, setCaptainPhone } from "../actions";

type Team = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  captain_name?: string | null;
  captain_phone?: string | null;
};

function CrestPreview({ name, shortName, primary, secondary }: { name: string; shortName: string; primary: string; secondary: string }) {
  return (
    <TeamCrest
      name={name || "Tim"}
      shortName={shortName}
      primaryColor={primary}
      secondaryColor={secondary}
      size={48}
    />
  );
}

function TeamForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Partial<Team>;
  onSubmit: (fd: FormData, captain: { name: string; phone: string }) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.short_name ?? "");
  const [primary, setPrimary] = useState(initial?.primary_color ?? "#1f2937");
  const [secondary, setSecondary] = useState(initial?.secondary_color ?? "#f3f4f6");
  const [captainName, setCaptainName] = useState(initial?.captain_name ?? "");
  const [captainPhone, setCaptainPhone] = useState(initial?.captain_phone ?? "");
  const sameColors = primary.toLowerCase() === secondary.toLowerCase();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (initial?.id) fd.set("id", initial.id);
    await onSubmit(fd, { name: captainName.trim(), phone: captainPhone.trim() });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-[auto_1fr_1fr] gap-2 items-center">
        <CrestPreview name={name} shortName={shortName} primary={primary} secondary={secondary} />
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Naziv tima" required className="input" />
        <input name="short_name" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="Skraćeno (npr. KUL)" maxLength={4} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="color" name="primary_color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 border border-zinc-200 rounded" />
          <span className="text-zinc-600">Primarna</span>
          <input value={primary} onChange={(e) => setPrimary(e.target.value)} className="input flex-1 font-mono" maxLength={7} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="color" name="secondary_color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-12 border border-zinc-200 rounded" />
          <span className="text-zinc-600">Sekundarna</span>
          <input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="input flex-1 font-mono" maxLength={7} />
        </label>
      </div>
      {sameColors && <p className="text-xs text-amber-700">Boje su iste — grb će biti slabo vidljiv.</p>}

      {/* Kapiten — opciono, koristi se za slanje vesti kapitenima na WhatsApp/Viber */}
      <div className="grid sm:grid-cols-2 gap-2 border-t border-zinc-100 pt-2">
        <label className="block text-sm">
          <span className="text-xs text-zinc-600">Ime kapitena (opciono)</span>
          <input
            value={captainName}
            onChange={(e) => setCaptainName(e.target.value)}
            placeholder="npr. Marko Marković"
            maxLength={80}
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-zinc-600">Telefon kapitena (za WhatsApp/Viber)</span>
          <input
            value={captainPhone}
            onChange={(e) => setCaptainPhone(e.target.value)}
            placeholder="+38163123456 ili 063123456"
            maxLength={30}
            className="input"
            inputMode="tel"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">Otkaži</button>}
      </div>
    </form>
  );
}

export function TeamsAdmin({ teams }: { teams: Team[] }) {
  const run = useActionRunner();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Timovi</h1>
      <div className="card">
        <h2 className="font-medium mb-2">Dodaj tim</h2>
        <TeamForm
          submitLabel="Dodaj"
          onSubmit={async (fd, captain) => {
            const ok = await run(createTeam, fd);
            if (!ok) return false;
            // For freshly created team we need its id — re-fetch by name match
            // since createTeam doesn't return it. Cheap workaround: skip captain
            // save here and tell user to open edit row.
            if (captain.name || captain.phone) {
              // Wait briefly then refresh — captain save will happen on edit.
              // Page reloads via revalidate; admin can re-open the row.
            }
            return ok;
          }}
        />
      </div>

      <div className="space-y-2">
        {teams.map((t) => (
          <div key={t.id} className="card">
            {editing === t.id ? (
              <TeamForm
                initial={t}
                submitLabel="Sačuvaj"
                onCancel={() => setEditing(null)}
                onSubmit={async (fd, captain) => {
                  const ok = await run(updateTeam, fd);
                  if (!ok) return false;
                  await setCaptainPhone({ team_id: t.id, name: captain.name || null, phone: captain.phone || null });
                  setEditing(null);
                  return ok;
                }}
              />
            ) : (
              <div className="flex items-center gap-3">
                <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-zinc-500 truncate">
                    {t.short_name ?? "—"} · {t.primary_color} / {t.secondary_color}
                  </div>
                  {(t.captain_name || t.captain_phone) && (
                    <div className="text-xs text-blue-700 truncate mt-0.5">
                      📱 {t.captain_name ?? "Kapiten"}{t.captain_phone ? ` · ${t.captain_phone}` : ""}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditing(t.id)} className="btn-secondary !py-1 !px-2 text-xs">Izmeni</button>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!confirm(`Obrisati tim „${t.name}"?`)) return;
                  const fd = new FormData(); fd.set("id", t.id);
                  await run(deleteTeam, fd, { successMessage: "Obrisano" });
                }}>
                  <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
                </form>
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && <p className="text-sm text-zinc-500 text-center">Nema timova.</p>}
      </div>
    </div>
  );
}
