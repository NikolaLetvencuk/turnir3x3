"use client";

import { useState } from "react";
import { Users, Plus, Pencil, Trash2, X } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { PageHeader } from "@/components/admin/PageHeader";
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
  players?: Array<{ id: string; name: string }>;
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
          <input type="color" name="primary_color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-12 border border-zinc-800 rounded" />
          <span className="text-zinc-400">Primarna</span>
          <input value={primary} onChange={(e) => setPrimary(e.target.value)} className="input flex-1 font-mono" maxLength={7} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="color" name="secondary_color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-9 w-12 border border-zinc-800 rounded" />
          <span className="text-zinc-400">Sekundarna</span>
          <input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="input flex-1 font-mono" maxLength={7} />
        </label>
      </div>
      {sameColors && <p className="text-xs text-amber-700">Boje su iste — grb će biti slabo vidljiv.</p>}

      {/* Kapiten — bira se iz liste igrača ovog tima */}
      <div className="grid sm:grid-cols-2 gap-2 border-t border-zinc-800 pt-2">
        <label className="block text-sm">
          <span className="text-xs text-zinc-400">Kapiten (izaberi igrača)</span>
          {!initial?.id ? (
            <p className="text-xs text-zinc-500 italic input flex items-center !cursor-not-allowed bg-zinc-800">
              Prvo sačuvaj tim, pa dodaj igrače, pa se vrati.
            </p>
          ) : !initial?.players || initial.players.length === 0 ? (
            <p className="text-xs text-amber-700 italic input flex items-center !cursor-not-allowed bg-amber-50">
              Dodaj igrače timu u sekciji Igrači, pa se vrati ovde.
            </p>
          ) : (
            <select
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              className="input"
            >
              <option value="">— bez kapitena —</option>
              {initial.players.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          )}
        </label>
        <label className="block text-sm">
          <span className="text-xs text-zinc-400">Telefon kapitena (za WhatsApp/Viber/SMS)</span>
          <input
            value={captainPhone}
            onChange={(e) => setCaptainPhone(e.target.value)}
            placeholder="+38163123456 ili 063123456"
            maxLength={30}
            className="input"
            inputMode="tel"
            disabled={!initial?.id}
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
  const [showNew, setShowNew] = useState(teams.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        title="Timovi"
        hint="Dodaj sve ekipe koje učestvuju. Zatim u Igračima upiši njihove igrače."
        tone="blue"
      />

      {!showNew ? (
        <button
          onClick={() => setShowNew(true)}
          className="card flex items-center justify-between gap-3 hover:border-blue-300 hover:bg-blue-50 transition w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-300 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Dodaj novi tim</div>
              <div className="text-xs text-zinc-500">Naziv, boje i logo</div>
            </div>
          </div>
        </button>
      ) : (
        <div className="card border-blue-300 border-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Novi tim</h2>
            <button onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-zinc-300" aria-label="Otkaži">
              <X className="w-4 h-4" />
            </button>
          </div>
          <TeamForm
            submitLabel="Dodaj"
              onSubmit={async (fd, captain) => {
              const ok = await run(createTeam, fd);
              if (!ok) return false;
              if (captain.name || captain.phone) {
                // Captain save happens after team gets an id — admin can edit row.
              }
              setShowNew(false);
              return ok;
            }}
            onCancel={() => setShowNew(false)}
          />
        </div>
      )}

      <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold px-1 pt-1">
        Postojeći timovi ({teams.length})
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
                    <div className="text-xs text-blue-300 truncate mt-0.5">
                      📱 {t.captain_name ?? "Kapiten"}{t.captain_phone ? ` · ${t.captain_phone}` : ""}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEditing(t.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1.5 text-xs"
                  aria-label="Izmeni"
                  title="Izmeni"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!confirm(`Obrisati tim „${t.name}"?`)) return;
                  const fd = new FormData(); fd.set("id", t.id);
                  await run(deleteTeam, fd, { successMessage: "Obrisano" });
                }}>
                  <button
                    className="inline-flex items-center gap-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 px-2 py-1.5 text-xs"
                    aria-label="Obriši"
                    title="Obriši"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && (
          <div className="card text-center text-sm text-zinc-500 py-6">
            Još nema timova. Klikni <b>Dodaj novi tim</b> iznad.
          </div>
        )}
      </div>
    </div>
  );
}
