"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TeamCrest } from "@/components/TeamCrest";
import { DrawAnimation } from "@/components/admin/DrawAnimation";
import { useToast } from "@/components/ui/Toast";
import { computeDraw, type DrawResult, type DrawTeam } from "@/lib/draw";
import { commitDraw } from "../actions";

type Phase = "config" | "animating" | "preview" | "saving";

export function DrawClient({ teams, hasExisting }: { teams: DrawTeam[]; hasExisting: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [groupCount, setGroupCount] = useState(Math.max(2, Math.min(8, Math.floor(teams.length / 3) || 2)));
  const [phase, setPhase] = useState<Phase>("config");
  const [result, setResult] = useState<DrawResult | null>(null);

  function startDraw() {
    if (teams.length < groupCount * 2) {
      push(`Premalo timova za ${groupCount} grupa — treba ti bar ${groupCount * 2}`, "error");
      return;
    }
    if (hasExisting) {
      if (!confirm("Postojeća kola, grupe i mečevi će biti obrisani. Nastaviti?")) return;
    }
    const r = computeDraw(teams, groupCount);
    setResult(r);
    setPhase("animating");
  }

  function reroll() {
    const r = computeDraw(teams, groupCount);
    setResult(r);
    setPhase("animating");
  }

  async function commit() {
    if (!result) return;
    setPhase("saving");
    const payload = {
      groups: result.groups.map((g) => ({ name: g.name, team_ids: g.teams.map((t) => t.id) })),
      rounds: result.rounds.map((r) => ({
        name: r.name,
        matches: r.matches.map((m) => ({ group_index: m.group_index, home_team_id: m.home.id, away_team_id: m.away.id })),
      })),
    };
    const res = await commitDraw(payload);
    if (!res.ok) { push(res.error, "error"); setPhase("preview"); return; }
    push("Žreb sačuvan", "success");
    router.push("/admin/schedule");
    router.refresh();
  }

  if (phase === "animating" && result) {
    return (
      <DrawAnimation
        result={result}
        onSkip={() => setPhase("preview")}
        onDone={() => setPhase("preview")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Žreb grupa</h1>

      {phase === "config" && (
        <>
          <div className="card space-y-3">
            <div>
              <label className="label">Broj grupa (2–8)</label>
              <input
                type="number"
                min={2}
                max={8}
                value={groupCount}
                onChange={(e) => setGroupCount(Math.max(2, Math.min(8, Number(e.target.value) || 2)))}
                className="input w-24"
              />
            </div>
            <p className="text-sm text-zinc-600">
              Prijavljeno timova: <b>{teams.length}</b>. Sistem će ravnomerno rasporediti timove ({Math.floor(teams.length / groupCount)}–{Math.ceil(teams.length / groupCount)} po grupi).
            </p>
            {hasExisting && (
              <p className="text-sm text-amber-700">
                Postojeća kola i mečevi će biti obrisani pre novog žreba (timovi i igrači ostaju).
              </p>
            )}
            <button onClick={startDraw} disabled={teams.length < 2} className="btn-primary">Pokreni žreb</button>
          </div>
          <div className="card">
            <h2 className="font-medium mb-2">Timovi u žrebu</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {teams.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={28} />
                  <span className="truncate">{t.name}</span>
                </div>
              ))}
              {teams.length === 0 && <p className="text-sm text-zinc-500 col-span-full">Dodaj prvo timove u sekciji „Timovi".</p>}
            </div>
          </div>
        </>
      )}

      {(phase === "preview" || phase === "saving") && result && (
        <>
          <div className="card">
            <h2 className="font-medium mb-2">Rezultat žreba</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.groups.map((g) => (
                <div key={g.name} className="border border-zinc-200 rounded-md p-3">
                  <div className="font-semibold mb-1">{g.name}</div>
                  <ul className="space-y-1 text-sm">
                    {g.teams.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <TeamCrest name={t.name} shortName={t.short_name} primaryColor={t.primary_color} secondaryColor={t.secondary_color} size={24} />
                        {t.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-medium mb-2">Mečevi po kolu</h2>
            <div className="space-y-3">
              {result.rounds.map((r) => (
                <div key={r.name}>
                  <div className="font-medium text-sm text-zinc-600 mb-1">{r.name}</div>
                  <ul className="space-y-1 text-sm">
                    {r.matches.map((m, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <TeamCrest name={m.home.name} shortName={m.home.short_name} primaryColor={m.home.primary_color} secondaryColor={m.home.secondary_color} size={20} />
                        <span>{m.home.name}</span>
                        <span className="text-zinc-400">vs</span>
                        <TeamCrest name={m.away.name} shortName={m.away.short_name} primaryColor={m.away.primary_color} secondaryColor={m.away.secondary_color} size={20} />
                        <span>{m.away.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={commit} disabled={phase === "saving"} className="btn-primary">{phase === "saving" ? "Čuvam…" : "Potvrdi"}</button>
            <button onClick={reroll} disabled={phase === "saving"} className="btn-secondary">Ponovi žreb</button>
            <button onClick={() => setPhase("config")} disabled={phase === "saving"} className="btn-secondary">Odustani</button>
          </div>
        </>
      )}
    </div>
  );
}
